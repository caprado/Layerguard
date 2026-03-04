import { describe, it, expect } from 'vitest'
import {
  violationToJson,
  reportToJson,
  formatJsonViolations,
  formatJsonReport,
} from '../../../src/output/json.js'
import {
  createFlowViolation,
  createIsolationViolation,
  createCircularViolation,
  createUnmappedViolation,
  createViolationReport,
} from '../../../src/enforcer/violations.js'

describe('violationToJson', () => {
  it('converts a flow violation to JSON', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/hooks/useFetch.ts',
      targetFile: 'src/components/Button.tsx',
      sourceLayer: 'hooks',
      targetLayer: 'components',
      importSpecifier: '../components/Button',
      line: 10,
    })

    const json = violationToJson(violation)

    expect(json.type).toBe('flow')
    expect(json.severity).toBe('error')
    expect(json.sourceFile).toBe('src/hooks/useFetch.ts')
    expect(json.targetFile).toBe('src/components/Button.tsx')
    expect(json.sourceLayer).toBe('hooks')
    expect(json.targetLayer).toBe('components')
    expect(json.importSpecifier).toBe('../components/Button')
    expect(json.line).toBe(10)
    expect(json.message).toBeDefined()
    expect(json.suggestion).toBeDefined()
  })

  it('converts an isolation violation to JSON with features', () => {
    const violation = createIsolationViolation({
      sourceFile: 'src/features/calendar/index.ts',
      targetFile: 'src/features/build/utils.ts',
      sourceLayer: 'features',
      sourceSublayer: 'calendar',
      targetSublayer: 'build',
      sourceFeature: 'calendar',
      targetFeature: 'build',
      importSpecifier: '../build/utils',
    })

    const json = violationToJson(violation)

    expect(json.type).toBe('isolation')
    expect(json.sourceFeature).toBe('calendar')
    expect(json.targetFeature).toBe('build')
  })

  it('converts a circular violation to JSON with cycle path', () => {
    const violation = createCircularViolation({
      cyclePath: ['a.ts', 'b.ts', 'c.ts', 'a.ts'],
    })

    const json = violationToJson(violation)

    expect(json.type).toBe('circular')
    expect(json.cyclePath).toEqual(['a.ts', 'b.ts', 'c.ts', 'a.ts'])
  })

  it('converts an unmapped violation to JSON', () => {
    const violation = createUnmappedViolation({
      sourceFile: 'src/orphan.ts',
    })

    const json = violationToJson(violation)

    expect(json.type).toBe('unmapped')
    expect(json.sourceFile).toBe('src/orphan.ts')
  })

  it('omits undefined optional fields', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/a.ts',
      targetFile: 'src/b.ts',
      sourceLayer: 'a',
      targetLayer: 'b',
      importSpecifier: './b',
    })

    const json = violationToJson(violation)

    expect(json.line).toBeUndefined()
    expect(json.cyclePath).toBeUndefined()
    expect(json.sourceFeature).toBeUndefined()
    expect(json.targetFeature).toBeUndefined()
  })
})

describe('reportToJson', () => {
  it('converts a report to JSON', () => {
    const violations = [
      createFlowViolation({
        sourceFile: 'src/a.ts',
        targetFile: 'src/b.ts',
        sourceLayer: 'a',
        targetLayer: 'b',
        importSpecifier: './b',
      }),
      createUnmappedViolation({
        sourceFile: 'src/other.ts',
        severity: 'warn',
      }),
    ]
    const report = createViolationReport(violations)

    const json = reportToJson(report)

    expect(json.passed).toBe(false)
    expect(json.summary.total).toBe(2)
    expect(json.summary.errors).toBe(1)
    expect(json.summary.warnings).toBe(1)
    expect(json.summary.byType.flow).toBe(1)
    expect(json.summary.byType.unmapped).toBe(1)
    expect(json.summary.byType.circular).toBe(0)
    expect(json.summary.byType.isolation).toBe(0)
    expect(json.violations).toHaveLength(2)
  })

  it('converts an empty report to JSON', () => {
    const report = createViolationReport([])

    const json = reportToJson(report)

    expect(json.passed).toBe(true)
    expect(json.summary.total).toBe(0)
    expect(json.violations).toHaveLength(0)
  })
})

describe('formatJsonViolations', () => {
  it('formats violations as minified JSON', () => {
    const violations = [
      createFlowViolation({
        sourceFile: 'src/a.ts',
        targetFile: 'src/b.ts',
        sourceLayer: 'a',
        targetLayer: 'b',
        importSpecifier: './b',
      }),
    ]

    const output = formatJsonViolations(violations)
    const parsed = JSON.parse(output)

    expect(parsed).toHaveLength(1)
    expect(output).not.toContain('\n')
  })

  it('formats violations as pretty JSON', () => {
    const violations = [
      createFlowViolation({
        sourceFile: 'src/a.ts',
        targetFile: 'src/b.ts',
        sourceLayer: 'a',
        targetLayer: 'b',
        importSpecifier: './b',
      }),
    ]

    const output = formatJsonViolations(violations, true)

    expect(output).toContain('\n')
    expect(output).toContain('  ')
  })

  it('returns empty array for no violations', () => {
    const output = formatJsonViolations([])

    expect(output).toBe('[]')
  })
})

describe('formatJsonReport', () => {
  it('formats a report as minified JSON', () => {
    const violations = [
      createFlowViolation({
        sourceFile: 'src/a.ts',
        targetFile: 'src/b.ts',
        sourceLayer: 'a',
        targetLayer: 'b',
        importSpecifier: './b',
      }),
    ]
    const report = createViolationReport(violations)

    const output = formatJsonReport(report)
    const parsed = JSON.parse(output)

    expect(parsed.passed).toBe(false)
    expect(parsed.summary).toBeDefined()
    expect(parsed.violations).toHaveLength(1)
    expect(output).not.toContain('\n')
  })

  it('formats a report as pretty JSON', () => {
    const report = createViolationReport([])

    const output = formatJsonReport(report, true)

    expect(output).toContain('\n')
    expect(output).toContain('  ')
  })

  it('produces valid JSON that can be parsed', () => {
    const violations = [
      createFlowViolation({
        sourceFile: 'src/hooks/useFetch.ts',
        targetFile: 'src/components/Button.tsx',
        sourceLayer: 'hooks',
        targetLayer: 'components',
        importSpecifier: '../components/Button',
      }),
      createIsolationViolation({
        sourceFile: 'src/features/a/index.ts',
        targetFile: 'src/features/b/utils.ts',
        sourceLayer: 'features',
        sourceSublayer: 'a',
        targetSublayer: 'b',
        sourceFeature: 'a',
        targetFeature: 'b',
        importSpecifier: '../b/utils',
      }),
      createCircularViolation({
        cyclePath: ['x.ts', 'y.ts', 'z.ts', 'x.ts'],
      }),
    ]
    const report = createViolationReport(violations)

    const output = formatJsonReport(report, true)

    expect(() => JSON.parse(output)).not.toThrow()
    const parsed = JSON.parse(output)
    expect(parsed.violations).toHaveLength(3)
  })
})
