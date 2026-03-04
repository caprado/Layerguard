/**
 * Tests for HTML report generation
 */

import { describe, it, expect } from 'vitest'
import {
  generateHtmlReport,
  generateMarkdownSummary,
  groupViolationsByType,
  generateTrendChartData,
  type HistoricalDataPoint,
} from '../../../src/output/html.js'
import type { ViolationReport, Violation } from '../../../src/enforcer/violations.js'

function createMockReport(violations: Violation[] = []): ViolationReport {
  const counts = {
    flow: 0,
    isolation: 0,
    circular: 0,
    unmapped: 0,
    unlayered: 0,
    depth: 0,
    publicApi: 0,
    dependentBudget: 0,
    importCount: 0,
    total: 0,
  }

  let errorCount = 0
  let warnCount = 0

  for (const v of violations) {
    if (v.type === 'flow') counts.flow++
    if (v.type === 'isolation') counts.isolation++
    if (v.type === 'circular') counts.circular++
    if (v.type === 'unmapped') counts.unmapped++
    if (v.type === 'unlayered') counts.unlayered++
    if (v.type === 'depth') counts.depth++
    if (v.type === 'publicApi') counts.publicApi++
    if (v.type === 'dependentBudget') counts.dependentBudget++
    if (v.type === 'importCount') counts.importCount++

    if (v.severity === 'error') errorCount++
    if (v.severity === 'warn') warnCount++
    counts.total++
  }

  return {
    violations,
    counts,
    severityCounts: {
      error: errorCount,
      warn: warnCount,
    },
    passed: errorCount === 0,
  }
}

function createMockViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    type: 'flow',
    severity: 'error',
    message: 'Test violation',
    sourceFile: 'src/test.ts',
    targetFile: 'src/other.ts',
    sourceLayer: 'feature',
    targetLayer: 'core',
    ...overrides,
  }
}

describe('generateHtmlReport', () => {
  it('generates valid HTML document', () => {
    const report = createMockReport([])
    const html = generateHtmlReport(report)

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
    expect(html).toContain('Archgate Report')
  })

  it('includes title in output', () => {
    const report = createMockReport([])
    const html = generateHtmlReport(report, { title: 'My Custom Report' })

    expect(html).toContain('My Custom Report')
  })

  it('includes project name', () => {
    const report = createMockReport([])
    const html = generateHtmlReport(report, { projectName: 'my-project' })

    expect(html).toContain('my-project')
  })

  it('shows passed status when no errors', () => {
    const report = createMockReport([])
    const html = generateHtmlReport(report)

    expect(html).toContain('Passed')
    expect(html).toContain('status-passed')
  })

  it('shows failed status when errors exist', () => {
    const report = createMockReport([createMockViolation()])
    const html = generateHtmlReport(report)

    expect(html).toContain('Failed')
    expect(html).toContain('status-failed')
  })

  it('includes violation counts', () => {
    const report = createMockReport([
      createMockViolation({ type: 'flow' }),
      createMockViolation({ type: 'flow' }),
      createMockViolation({ type: 'circular' }),
    ])
    const html = generateHtmlReport(report)

    expect(html).toContain('3') // total
  })

  it('includes stats when provided', () => {
    const report = createMockReport([])
    const html = generateHtmlReport(report, {
      stats: { fileCount: 100, importCount: 500 },
    })

    expect(html).toContain('100')
    expect(html).toContain('Files Analyzed')
  })

  it('includes violation details', () => {
    const report = createMockReport([
      createMockViolation({
        sourceFile: 'src/features/user.ts',
        message: 'Cannot import core from feature',
      }),
    ])
    const html = generateHtmlReport(report)

    expect(html).toContain('src/features/user.ts')
    expect(html).toContain('Cannot import core from feature')
  })

  it('includes historical trend when provided', () => {
    const history: HistoricalDataPoint[] = [
      {
        timestamp: '2024-01-01T00:00:00Z',
        date: '2024-01-01',
        counts: { flow: 5, isolation: 0, circular: 0, unmapped: 0, unlayered: 0, depth: 0, publicApi: 0, dependentBudget: 0, importCount: 0, total: 5 },
        fileCount: 50,
        importCount: 200,
      },
      {
        timestamp: '2024-01-02T00:00:00Z',
        date: '2024-01-02',
        counts: { flow: 3, isolation: 0, circular: 0, unmapped: 0, unlayered: 0, depth: 0, publicApi: 0, dependentBudget: 0, importCount: 0, total: 3 },
        fileCount: 55,
        importCount: 220,
      },
    ]
    const report = createMockReport([])
    const html = generateHtmlReport(report, { history })

    expect(html).toContain('Trend')
    expect(html).toContain('data points')
  })

  it('escapes HTML in violation messages', () => {
    const report = createMockReport([
      createMockViolation({
        message: '<script>alert("xss")</script>',
      }),
    ])
    const html = generateHtmlReport(report)

    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('limits violations table to 100 rows', () => {
    const violations: Violation[] = []
    for (let i = 0; i < 150; i++) {
      violations.push(createMockViolation({ sourceFile: `src/file${i}.ts` }))
    }
    const report = createMockReport(violations)
    const html = generateHtmlReport(report)

    expect(html).toContain('Showing first 100 of 150 violations')
  })
})

describe('generateMarkdownSummary', () => {
  it('generates markdown with status', () => {
    const report = createMockReport([])
    const md = generateMarkdownSummary(report)

    expect(md).toContain('## Archgate Check')
    expect(md).toContain('Passed')
  })

  it('shows failed status when errors exist', () => {
    const report = createMockReport([createMockViolation()])
    const md = generateMarkdownSummary(report)

    expect(md).toContain('Failed')
  })

  it('includes summary table', () => {
    const report = createMockReport([createMockViolation()])
    const md = generateMarkdownSummary(report)

    expect(md).toContain('| Metric | Count |')
    expect(md).toContain('| Errors |')
    expect(md).toContain('| Warnings |')
    expect(md).toContain('| Total |')
  })

  it('includes violations by type when present', () => {
    const report = createMockReport([
      createMockViolation({ type: 'flow' }),
      createMockViolation({ type: 'circular' }),
    ])
    const md = generateMarkdownSummary(report)

    expect(md).toContain('Violations by Type')
    expect(md).toContain('**flow**')
    expect(md).toContain('**circular**')
  })

  it('includes top violations when showDetails is true', () => {
    const report = createMockReport([
      createMockViolation({
        sourceFile: 'src/test.ts',
        message: 'Test violation message',
      }),
    ])
    const md = generateMarkdownSummary(report, { showDetails: true })

    expect(md).toContain('Top Violations')
    expect(md).toContain('src/test.ts')
    expect(md).toContain('Test violation message')
  })

  it('hides top violations when showDetails is false', () => {
    const report = createMockReport([createMockViolation()])
    const md = generateMarkdownSummary(report, { showDetails: false })

    expect(md).not.toContain('Top Violations')
  })

  it('shows "and X more" when many violations', () => {
    const violations: Violation[] = []
    for (let i = 0; i < 10; i++) {
      violations.push(createMockViolation({ sourceFile: `src/file${i}.ts` }))
    }
    const report = createMockReport(violations)
    const md = generateMarkdownSummary(report, { showDetails: true })

    expect(md).toContain('and 5 more')
  })

  it('includes footer with link', () => {
    const report = createMockReport([])
    const md = generateMarkdownSummary(report)

    expect(md).toContain('Generated by')
    expect(md).toContain('Archgate')
  })
})

describe('groupViolationsByType', () => {
  it('groups violations by type', () => {
    const violations: Violation[] = [
      createMockViolation({ type: 'flow' }),
      createMockViolation({ type: 'flow' }),
      createMockViolation({ type: 'circular' }),
    ]

    const groups = groupViolationsByType(violations)

    expect(groups.get('flow')?.length).toBe(2)
    expect(groups.get('circular')?.length).toBe(1)
    expect(groups.get('isolation')).toBeUndefined()
  })

  it('handles empty violations', () => {
    const groups = groupViolationsByType([])

    expect(groups.size).toBe(0)
  })
})

describe('generateTrendChartData', () => {
  it('extracts date and total from history', () => {
    const history: HistoricalDataPoint[] = [
      {
        timestamp: '2024-01-01T00:00:00Z',
        date: '2024-01-01',
        counts: { flow: 5, isolation: 0, circular: 0, unmapped: 0, unlayered: 0, depth: 0, publicApi: 0, dependentBudget: 0, importCount: 0, total: 5 },
        fileCount: 50,
        importCount: 200,
      },
      {
        timestamp: '2024-01-02T00:00:00Z',
        date: '2024-01-02',
        counts: { flow: 3, isolation: 0, circular: 0, unmapped: 0, unlayered: 0, depth: 0, publicApi: 0, dependentBudget: 0, importCount: 0, total: 3 },
        fileCount: 55,
        importCount: 220,
      },
    ]

    const data = generateTrendChartData(history)

    expect(data).toHaveLength(2)
    expect(data[0]).toEqual({ date: '2024-01-01', total: 5 })
    expect(data[1]).toEqual({ date: '2024-01-02', total: 3 })
  })

  it('handles empty history', () => {
    const data = generateTrendChartData([])

    expect(data).toHaveLength(0)
  })
})
