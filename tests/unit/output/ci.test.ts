import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  formatGitHubAnnotation,
  formatGitHubAnnotations,
  formatCIReport,
  formatGroupStart,
  formatGroupEnd,
  isGitHubActions,
  isCI,
} from '../../../src/output/ci.js'
import {
  createFlowViolation,
  createIsolationViolation,
  createCircularViolation,
  createUnmappedViolation,
  createViolationReport,
} from '../../../src/enforcer/violations.js'

describe('formatGitHubAnnotation', () => {
  it('formats a flow violation as error annotation', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/hooks/useFetch.ts',
      targetFile: 'src/components/Button.tsx',
      sourceLayer: 'hooks',
      targetLayer: 'components',
      importSpecifier: '../components/Button',
      line: 10,
    })

    const output = formatGitHubAnnotation(violation)

    expect(output).toBe(
      `::error file=src/hooks/useFetch.ts,line=10,title=Layer violation: hooks → components::${violation.message}`
    )
  })

  it('formats a warning as warning annotation', () => {
    const violation = createUnmappedViolation({
      sourceFile: 'src/other/file.ts',
      severity: 'warn',
    })

    const output = formatGitHubAnnotation(violation)

    expect(output).toMatch(/^::warning file=src\/other\/file\.ts/)
  })

  it('uses line 1 when no line is provided', () => {
    const violation = createFlowViolation({
      sourceFile: 'src/a.ts',
      targetFile: 'src/b.ts',
      sourceLayer: 'a',
      targetLayer: 'b',
      importSpecifier: './b',
    })

    const output = formatGitHubAnnotation(violation)

    expect(output).toContain('line=1')
  })

  it('formats an isolation violation', () => {
    const violation = createIsolationViolation({
      sourceFile: 'src/features/a/index.ts',
      targetFile: 'src/features/b/utils.ts',
      sourceLayer: 'features',
      sourceSublayer: 'a',
      targetSublayer: 'b',
      sourceFeature: 'a',
      targetFeature: 'b',
      importSpecifier: '../b/utils',
    })

    const output = formatGitHubAnnotation(violation)

    expect(output).toContain('title=Feature isolation violation')
  })

  it('formats a circular violation', () => {
    const violation = createCircularViolation({
      cyclePath: ['a.ts', 'b.ts', 'a.ts'],
    })

    const output = formatGitHubAnnotation(violation)

    expect(output).toContain('title=Circular dependency')
  })

  it('formats an unmapped violation', () => {
    const violation = createUnmappedViolation({
      sourceFile: 'src/orphan.ts',
    })

    const output = formatGitHubAnnotation(violation)

    expect(output).toContain('title=Unmapped file')
  })
})

describe('formatGitHubAnnotations', () => {
  it('formats multiple violations as newline-separated annotations', () => {
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

    const output = formatGitHubAnnotations(violations)
    const lines = output.split('\n')

    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^::error/)
    expect(lines[1]).toMatch(/^::warning/)
  })

  it('returns empty string for no violations', () => {
    const output = formatGitHubAnnotations([])

    expect(output).toBe('')
  })
})

describe('formatCIReport', () => {
  it('formats a report with violations', () => {
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

    const output = formatCIReport(report)
    const lines = output.split('\n')

    expect(lines[0]).toMatch(/^::error/)
    expect(lines[1]).toMatch(/^::notice::Found 1 violation/)
  })

  it('formats a report with no violations', () => {
    const report = createViolationReport([])

    const output = formatCIReport(report)

    expect(output).toBe('::notice::No architectural violations found')
  })

  it('includes error and warning counts in summary', () => {
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

    const output = formatCIReport(report)

    expect(output).toContain('2 violation(s)')
    expect(output).toContain('1 error(s)')
    expect(output).toContain('1 warning(s)')
  })
})

describe('formatGroupStart', () => {
  it('formats a group start command', () => {
    const output = formatGroupStart('My Group')

    expect(output).toBe('::group::My Group')
  })
})

describe('formatGroupEnd', () => {
  it('formats a group end command', () => {
    const output = formatGroupEnd()

    expect(output).toBe('::endgroup::')
  })
})

describe('isGitHubActions', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns true when GITHUB_ACTIONS is true', () => {
    process.env.GITHUB_ACTIONS = 'true'

    expect(isGitHubActions()).toBe(true)
  })

  it('returns false when GITHUB_ACTIONS is not set', () => {
    delete process.env.GITHUB_ACTIONS

    expect(isGitHubActions()).toBe(false)
  })

  it('returns false when GITHUB_ACTIONS is not true', () => {
    process.env.GITHUB_ACTIONS = 'false'

    expect(isGitHubActions()).toBe(false)
  })
})

describe('isCI', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns true for GitHub Actions', () => {
    process.env.GITHUB_ACTIONS = 'true'

    expect(isCI()).toBe(true)
  })

  it('returns true for GitLab CI', () => {
    process.env.GITLAB_CI = 'true'

    expect(isCI()).toBe(true)
  })

  it('returns true for CircleCI', () => {
    process.env.CIRCLECI = 'true'

    expect(isCI()).toBe(true)
  })

  it('returns true for Travis CI', () => {
    process.env.TRAVIS = 'true'

    expect(isCI()).toBe(true)
  })

  it('returns true for Jenkins', () => {
    process.env.JENKINS_URL = 'http://jenkins.example.com'

    expect(isCI()).toBe(true)
  })

  it('returns true when CI env var is set', () => {
    process.env.CI = 'true'

    expect(isCI()).toBe(true)
  })

  it('returns false when no CI env vars are set', () => {
    delete process.env.CI
    delete process.env.GITHUB_ACTIONS
    delete process.env.GITLAB_CI
    delete process.env.CIRCLECI
    delete process.env.TRAVIS
    delete process.env.JENKINS_URL

    expect(isCI()).toBe(false)
  })
})
