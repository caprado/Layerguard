import { describe, it, expect } from 'vitest'
import {
  createFlowViolation,
  createIsolationViolation,
  createCircularViolation,
  createUnmappedViolation,
  createViolationReport,
} from '../../../src/enforcer/violations.js'

describe('createFlowViolation', () => {
  it('creates a flow violation with all required fields', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/hooks/useFetch.ts',
      targetFile: 'src/components/Button.tsx',
      sourceLayer: 'hooks',
      targetLayer: 'components',
      importSpecifier: '../components/Button',
    })

    expect(violation.type).toBe('flow')
    expect(violation.severity).toBe('error')
    expect(violation.sourceFile).toBe('src/hooks/useFetch.ts')
    expect(violation.targetFile).toBe('src/components/Button.tsx')
    expect(violation.sourceLayer).toBe('hooks')
    expect(violation.targetLayer).toBe('components')
    expect(violation.importSpecifier).toBe('../components/Button')
    expect(violation.message).toContain('hooks')
    expect(violation.message).toContain('components')
    expect(violation.suggestion).toBeDefined()
  })

  it('includes line number when provided', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/hooks/useFetch.ts',
      targetFile: 'src/components/Button.tsx',
      sourceLayer: 'hooks',
      targetLayer: 'components',
      importSpecifier: '../components/Button',
      line: 42,
    })

    expect(violation.line).toBe(42)
  })

  it('respects custom severity', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/a.ts',
      targetFile: 'src/b.ts',
      sourceLayer: 'a',
      targetLayer: 'b',
      importSpecifier: './b',
      severity: 'warn',
    })

    expect(violation.severity).toBe('warn')
  })
})

describe('createIsolationViolation', () => {
  it('creates an isolation violation with all required fields', () => {
    const violation = createIsolationViolation({
      sourceFile: 'src/components/features/calendar/Calendar.tsx',
      targetFile: 'src/components/features/build/BuildSchedule.tsx',
      sourceLayer: 'components',
      sourceSublayer: 'features',
      targetSublayer: 'features',
      sourceFeature: 'calendar',
      targetFeature: 'build',
      importSpecifier: '../build/BuildSchedule',
    })

    expect(violation.type).toBe('isolation')
    expect(violation.severity).toBe('error')
    expect(violation.sourceFeature).toBe('calendar')
    expect(violation.targetFeature).toBe('build')
    expect(violation.message).toContain('calendar')
    expect(violation.message).toContain('build')
  })
})

describe('createCircularViolation', () => {
  it('creates a circular violation', () => {
    const violation = createCircularViolation({
      cyclePath: ['a.ts', 'b.ts', 'c.ts', 'a.ts'],
    })

    expect(violation.type).toBe('circular')
    expect(violation.severity).toBe('error')
    expect(violation.cyclePath).toEqual(['a.ts', 'b.ts', 'c.ts', 'a.ts'])
    expect(violation.message).toContain('a.ts')
    expect(violation.message).toContain('b.ts')
    expect(violation.message).toContain('→')
  })
})

describe('createUnmappedViolation', () => {
  it('creates an unmapped violation', () => {
    const violation = createUnmappedViolation({
      sourceFile: 'src/other/file.ts',
    })

    expect(violation.type).toBe('unmapped')
    expect(violation.severity).toBe('warn')
    expect(violation.sourceFile).toBe('src/other/file.ts')
    expect(violation.message).toContain('src/other/file.ts')
  })

  it('respects custom severity', () => {
    const violation = createUnmappedViolation({
      sourceFile: 'src/other/file.ts',
      severity: 'error',
    })

    expect(violation.severity).toBe('error')
  })
})

describe('createViolationReport', () => {
  it('creates report with correct counts', () => {
    const violations = [
      createFlowViolation({
        sourceFile: 'a.ts',
        targetFile: 'b.ts',
        sourceLayer: 'a',
        targetLayer: 'b',
        importSpecifier: './b',
      }),
      createFlowViolation({
        sourceFile: 'c.ts',
        targetFile: 'd.ts',
        sourceLayer: 'c',
        targetLayer: 'd',
        importSpecifier: './d',
      }),
      createCircularViolation({
        cyclePath: ['x.ts', 'y.ts', 'x.ts'],
      }),
      createUnmappedViolation({
        sourceFile: 'z.ts',
      }),
    ]

    const report = createViolationReport(violations)

    expect(report.counts.flow).toBe(2)
    expect(report.counts.circular).toBe(1)
    expect(report.counts.unmapped).toBe(1)
    expect(report.counts.isolation).toBe(0)
    expect(report.counts.total).toBe(4)
  })

  it('counts severities correctly', () => {
    const violations = [
      createFlowViolation({
        sourceFile: 'a.ts',
        targetFile: 'b.ts',
        sourceLayer: 'a',
        targetLayer: 'b',
        importSpecifier: './b',
        severity: 'error',
      }),
      createUnmappedViolation({
        sourceFile: 'z.ts',
        severity: 'warn',
      }),
    ]

    const report = createViolationReport(violations)

    expect(report.severityCounts.error).toBe(1)
    expect(report.severityCounts.warn).toBe(1)
  })

  it('sets passed to true when no errors', () => {
    const violations = [
      createUnmappedViolation({
        sourceFile: 'z.ts',
        severity: 'warn',
      }),
    ]

    const report = createViolationReport(violations)

    expect(report.passed).toBe(true)
  })

  it('sets passed to false when errors exist', () => {
    const violations = [
      createFlowViolation({
        sourceFile: 'a.ts',
        targetFile: 'b.ts',
        sourceLayer: 'a',
        targetLayer: 'b',
        importSpecifier: './b',
      }),
    ]

    const report = createViolationReport(violations)

    expect(report.passed).toBe(false)
  })

  it('handles empty violations array', () => {
    const report = createViolationReport([])

    expect(report.counts.total).toBe(0)
    expect(report.passed).toBe(true)
  })
})
