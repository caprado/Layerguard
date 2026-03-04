import { describe, it, expect } from 'vitest'
import {
  formatViolation,
  formatReport,
  formatSuccess,
  formatError,
  formatStats,
} from '../../../src/output/terminal.js'
import {
  createFlowViolation,
  createIsolationViolation,
  createCircularViolation,
  createUnmappedViolation,
  createViolationReport,
} from '../../../src/enforcer/violations.js'

describe('formatViolation', () => {
  it('formats a flow violation with colors', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/hooks/useFetch.ts',
      targetFile: 'src/components/Button.tsx',
      sourceLayer: 'hooks',
      targetLayer: 'components',
      importSpecifier: '../components/Button',
      line: 5,
    })

    const output = formatViolation(violation)

    expect(output).toContain('ERROR')
    expect(output).toContain('Layer violation')
    expect(output).toContain('src/hooks/useFetch.ts:5')
    expect(output).toContain('src/components/Button.tsx')
  })

  it('formats a flow violation without colors', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/hooks/useFetch.ts',
      targetFile: 'src/components/Button.tsx',
      sourceLayer: 'hooks',
      targetLayer: 'components',
      importSpecifier: '../components/Button',
    })

    const output = formatViolation(violation, { colors: false })

    expect(output).toContain('ERROR')
    expect(output).not.toContain('\x1b[')
  })

  it('formats a warning violation', () => {
    const violation = createUnmappedViolation({
      sourceFile: 'src/other/file.ts',
      severity: 'warn',
    })

    const output = formatViolation(violation)

    expect(output).toContain('WARN')
    expect(output).toContain('Unmapped file')
  })

  it('formats a circular violation with cycle path', () => {
    const violation = createCircularViolation({
      cyclePath: ['a.ts', 'b.ts', 'c.ts', 'a.ts'],
    })

    const output = formatViolation(violation)

    expect(output).toContain('Circular dependency')
    expect(output).toContain('a.ts')
    expect(output).toContain('→')
  })

  it('formats an isolation violation', () => {
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

    const output = formatViolation(violation)

    expect(output).toContain('Feature isolation')
  })

  it('includes suggestion when showSuggestions is true', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/a.ts',
      targetFile: 'src/b.ts',
      sourceLayer: 'a',
      targetLayer: 'b',
      importSpecifier: './b',
    })

    const output = formatViolation(violation, { showSuggestions: true })

    expect(output).toContain('Fix:')
  })

  it('hides suggestion when showSuggestions is false', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/a.ts',
      targetFile: 'src/b.ts',
      sourceLayer: 'a',
      targetLayer: 'b',
      importSpecifier: './b',
    })

    const output = formatViolation(violation, { showSuggestions: false })

    expect(output).not.toContain('Fix:')
  })
})

describe('formatReport', () => {
  it('formats a report with no violations', () => {
    const report = createViolationReport([])

    const output = formatReport(report)

    expect(output).toContain('archgate check')
    expect(output).toContain('No violations found')
    expect(output).toContain('✓')
  })

  it('formats a report with violations', () => {
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
      }),
    ]
    const report = createViolationReport(violations)

    const output = formatReport(report)

    expect(output).toContain('archgate check')
    expect(output).toContain('2 violations found')
    expect(output).toContain('1 error')
    expect(output).toContain('1 warning')
    expect(output).toContain('Layer violation')
    expect(output).toContain('Unmapped file')
  })

  it('formats a report without colors', () => {
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

    const output = formatReport(report, { colors: false })

    expect(output).not.toContain('\x1b[')
  })

  it('groups violations by type', () => {
    const violations = [
      createFlowViolation({
        sourceFile: 'src/a.ts',
        targetFile: 'src/b.ts',
        sourceLayer: 'a',
        targetLayer: 'b',
        importSpecifier: './b',
      }),
      createFlowViolation({
        sourceFile: 'src/c.ts',
        targetFile: 'src/d.ts',
        sourceLayer: 'c',
        targetLayer: 'd',
        importSpecifier: './d',
      }),
      createCircularViolation({
        cyclePath: ['x.ts', 'y.ts', 'x.ts'],
      }),
    ]
    const report = createViolationReport(violations)

    const output = formatReport(report)

    expect(output).toContain('Layer violation (2)')
    expect(output).toContain('Circular dependency (1)')
  })

  it('shows check mark for passed report', () => {
    const violations = [
      createUnmappedViolation({
        sourceFile: 'src/other.ts',
        severity: 'warn',
      }),
    ]
    const report = createViolationReport(violations)

    const output = formatReport(report)

    expect(output).toContain('✓')
  })

  it('shows x mark for failed report', () => {
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

    const output = formatReport(report)

    expect(output).toContain('✗')
  })
})

describe('formatSuccess', () => {
  it('formats a success message with colors', () => {
    const output = formatSuccess('All checks passed')

    expect(output).toContain('✓')
    expect(output).toContain('All checks passed')
  })

  it('formats a success message without colors', () => {
    const output = formatSuccess('All checks passed', { colors: false })

    expect(output).toContain('✓')
    expect(output).not.toContain('\x1b[')
  })
})

describe('formatError', () => {
  it('formats an error message with colors', () => {
    const output = formatError('Something went wrong')

    expect(output).toContain('✗')
    expect(output).toContain('Something went wrong')
  })

  it('formats an error message without colors', () => {
    const output = formatError('Something went wrong', { colors: false })

    expect(output).toContain('✗')
    expect(output).not.toContain('\x1b[')
  })
})

describe('formatStats', () => {
  it('formats stats with file and edge counts', () => {
    const output = formatStats({
      fileCount: 42,
      edgeCount: 100,
    })

    expect(output).toContain('42 files')
    expect(output).toContain('100 imports')
  })

  it('formats stats with duration', () => {
    const output = formatStats({
      fileCount: 10,
      edgeCount: 20,
      duration: 150,
    })

    expect(output).toContain('150ms')
  })

  it('handles singular counts', () => {
    const output = formatStats({
      fileCount: 1,
      edgeCount: 1,
    })

    expect(output).toContain('1 file')
    expect(output).toContain('1 import')
    expect(output).not.toContain('files')
    expect(output).not.toContain('imports')
  })

  it('formats stats without colors', () => {
    const output = formatStats(
      {
        fileCount: 10,
        edgeCount: 20,
      },
      { colors: false }
    )

    expect(output).not.toContain('\x1b[')
  })
})
