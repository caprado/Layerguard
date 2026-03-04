import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runCheck } from '../../../src/cli/check.js'
import * as loader from '../../../src/config/loader.js'
import * as incrementalBuilder from '../../../src/parser/incremental.js'
import * as workspace from '../../../src/workspace/index.js'
import type { LayerguardConfig } from '../../../src/config/types.js'
import type { DependencyGraph } from '../../../src/parser/graph.js'
import type { IncrementalBuildResult } from '../../../src/parser/incremental.js'

// Mock the modules
vi.mock('../../../src/config/loader.js')
vi.mock('../../../src/parser/incremental.js')
vi.mock('../../../src/workspace/index.js')

describe('runCheck', () => {
  const mockConfig: LayerguardConfig = {
    layers: {
      components: { path: 'src/components' },
      hooks: { path: 'src/hooks' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> hooks', 'hooks -> utils', 'components -> utils'],
  }

  const mockEmptyGraph: DependencyGraph = {
    projectRoot: process.cwd(),
    files: new Set(),
    adjacencyList: new Map(),
    edges: [],
    parseErrors: new Map(),
    unresolvedImports: [],
    externalImports: new Set(),
  }

  const mockBuildResult: IncrementalBuildResult = {
    graph: mockEmptyGraph,
    cacheHit: false,
    filesParsed: 0,
    totalFiles: 0,
    duration: 10,
  }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns passed: true when no violations found', async () => {
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    const result = await runCheck()

    expect(result.passed).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.errorCount).toBe(0)
    expect(result.violations).toHaveLength(0)
  })

  it('returns check result with all required fields', async () => {
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    const result = await runCheck()

    // Check that result has all required fields
    expect(typeof result.passed).toBe('boolean')
    expect(typeof result.exitCode).toBe('number')
    expect(typeof result.errorCount).toBe('number')
    expect(typeof result.warningCount).toBe('number')
    expect(Array.isArray(result.violations)).toBe(true)
  })

  it('outputs in JSON format when requested', async () => {
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    await runCheck({ format: 'json' })

    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(() => JSON.parse(output)).not.toThrow()
  })

  it('outputs in CI format when requested', async () => {
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    await runCheck({ format: 'ci' })

    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('::notice::')
  })

  it('handles config load errors', async () => {
    vi.mocked(loader.loadConfig).mockRejectedValue(new Error('Config not found'))

    const result = await runCheck()

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(console.error).toHaveBeenCalled()
  })

  it('handles invalid config', async () => {
    const invalidConfig: LayerguardConfig = {
      layers: {
        invalid: { path: '' }, // Invalid: empty path
      },
      flow: [],
    }

    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: invalidConfig,
      configPath: 'layerguard.config.ts',
    })

    const result = await runCheck()

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(console.error).toHaveBeenCalled()
  })

  it('respects noColors option', async () => {
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    await runCheck({ noColors: true })

    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).not.toContain('\x1b[')
  })

  it('passes typeOnlyImports option to graph builder', async () => {
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    await runCheck({ typeOnlyImports: true })

    expect(incrementalBuilder.buildDependencyGraphIncremental).toHaveBeenCalledWith(
      expect.objectContaining({
        includeTypeOnlyImports: true,
      })
    )
  })

  it('uses config ignore patterns', async () => {
    const configWithIgnore: LayerguardConfig = {
      ...mockConfig,
      ignore: ['**/*.test.ts'],
    }

    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: configWithIgnore,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    await runCheck()

    expect(incrementalBuilder.buildDependencyGraphIncremental).toHaveBeenCalledWith(
      expect.objectContaining({
        ignore: ['**/*.test.ts'],
      })
    )
  })

  it('respects circular dependency rule setting', async () => {
    const configWithCircularOff: LayerguardConfig = {
      ...mockConfig,
      rules: {
        circular: 'off',
      },
    }

    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: configWithCircularOff,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    const result = await runCheck()

    // Should not find any circular violations when rule is off
    expect(result.violations.filter((v) => v.type === 'circular')).toHaveLength(0)
  })

  it('prints warnings from config validation', async () => {
    // Config with potential warning (e.g., framework that doesn't match project)
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    await runCheck({ format: 'terminal' })

    // Just ensure it runs without errors
    expect(console.log).toHaveBeenCalled()
  })

  it('outputs error in JSON format when config load fails', async () => {
    vi.mocked(loader.loadConfig).mockRejectedValue(new Error('Config not found'))

    const result = await runCheck({ format: 'json' })

    expect(result.passed).toBe(false)
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    const parsed = JSON.parse(output)
    expect(parsed.error).toBe('Config not found')
  })

  it('outputs error in CI format when config load fails', async () => {
    vi.mocked(loader.loadConfig).mockRejectedValue(new Error('Config not found'))

    const result = await runCheck({ format: 'ci' })

    expect(result.passed).toBe(false)
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('::error::')
    expect(output).toContain('Config not found')
  })

  it('respects noCache option', async () => {
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    await runCheck({ noCache: true })

    expect(incrementalBuilder.buildDependencyGraphIncremental).toHaveBeenCalledWith(
      expect.objectContaining({
        useCache: false,
      })
    )
  })
})

describe('runCheck with workspace options', () => {
  const mockConfig: LayerguardConfig = {
    layers: {
      components: { path: 'src/components' },
    },
    flow: [],
  }

  const mockEmptyGraph: DependencyGraph = {
    projectRoot: '/project',
    files: new Set(),
    adjacencyList: new Map(),
    edges: [],
    parseErrors: new Map(),
    unresolvedImports: [],
    externalImports: new Set(),
  }

  const mockBuildResult: IncrementalBuildResult = {
    graph: mockEmptyGraph,
    cacheHit: false,
    filesParsed: 0,
    totalFiles: 0,
    duration: 10,
  }

  const createMockPackage = (name: string, pkgPath: string) => ({
    name,
    path: pkgPath,
    relativePath: pkgPath.replace('/project/', ''),
    packageJsonPath: `${pkgPath}/package.json`,
  })

  const createMockPkgConfig = (name: string, pkgPath: string) => ({
    package: createMockPackage(name, pkgPath),
    configPath: `${pkgPath}/layerguard.config.ts`,
    config: null,
  })

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns error when no workspace detected with --package flag', async () => {
    vi.mocked(workspace.detectWorkspace).mockReturnValue({
      type: 'none',
      root: '/project',
      patterns: [],
      packages: [],
    })

    const result = await runCheck({ package: 'apps/web' })

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(console.error).toHaveBeenCalled()
  })

  it('returns error when no workspace detected with --all flag', async () => {
    vi.mocked(workspace.detectWorkspace).mockReturnValue({
      type: 'none',
      root: '/project',
      patterns: [],
      packages: [],
    })

    const result = await runCheck({ all: true })

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  it('returns error when no configs found in workspace', async () => {
    vi.mocked(workspace.detectWorkspace).mockReturnValue({
      type: 'pnpm',
      root: '/project',
      patterns: ['apps/*'],
      packages: [createMockPackage('web', '/project/apps/web')],
    })
    vi.mocked(workspace.discoverPackageConfigs).mockReturnValue({
      packageConfigs: [],
      rootConfig: null,
    })

    const result = await runCheck({ all: true })

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  it('returns error when specified package not found', async () => {
    const pkgConfig = createMockPkgConfig('web', '/project/apps/web')
    vi.mocked(workspace.detectWorkspace).mockReturnValue({
      type: 'pnpm',
      root: '/project',
      patterns: ['apps/*'],
      packages: [pkgConfig.package],
    })
    vi.mocked(workspace.discoverPackageConfigs).mockReturnValue({
      packageConfigs: [pkgConfig],
      rootConfig: null,
    })
    vi.mocked(workspace.findPackageConfig).mockReturnValue(null)

    const result = await runCheck({ package: 'nonexistent' })

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(1)
  })

  it('runs check on specific package when found', async () => {
    const pkgConfig = createMockPkgConfig('web', '/project/apps/web')
    vi.mocked(workspace.detectWorkspace).mockReturnValue({
      type: 'pnpm',
      root: '/project',
      patterns: ['apps/*'],
      packages: [pkgConfig.package],
    })
    vi.mocked(workspace.discoverPackageConfigs).mockReturnValue({
      packageConfigs: [pkgConfig],
      rootConfig: null,
    })
    vi.mocked(workspace.findPackageConfig).mockReturnValue(pkgConfig)
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: pkgConfig.configPath,
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    const result = await runCheck({ package: 'web' })

    expect(result.passed).toBe(true)
    expect(result.exitCode).toBe(0)
  })

  it('runs check on all packages with --all flag', async () => {
    const pkgConfig1 = createMockPkgConfig('web', '/project/apps/web')
    const pkgConfig2 = createMockPkgConfig('api', '/project/apps/api')
    vi.mocked(workspace.detectWorkspace).mockReturnValue({
      type: 'pnpm',
      root: '/project',
      patterns: ['apps/*'],
      packages: [pkgConfig1.package, pkgConfig2.package],
    })
    vi.mocked(workspace.discoverPackageConfigs).mockReturnValue({
      packageConfigs: [pkgConfig1, pkgConfig2],
      rootConfig: null,
    })
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    const result = await runCheck({ all: true })

    expect(result.passed).toBe(true)
    expect(loader.loadConfig).toHaveBeenCalledTimes(2)
  })

  it('outputs workspace summary in JSON format', async () => {
    const pkgConfig = createMockPkgConfig('web', '/project/apps/web')
    vi.mocked(workspace.detectWorkspace).mockReturnValue({
      type: 'pnpm',
      root: '/project',
      patterns: ['apps/*'],
      packages: [pkgConfig.package],
    })
    vi.mocked(workspace.discoverPackageConfigs).mockReturnValue({
      packageConfigs: [pkgConfig],
      rootConfig: null,
    })
    vi.mocked(workspace.findPackageConfig).mockReturnValue(pkgConfig)
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: pkgConfig.configPath,
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)

    await runCheck({ package: 'web', format: 'json' })

    const calls = vi.mocked(console.log).mock.calls
    const lastCall = calls[calls.length - 1]?.[0] as string
    const parsed = JSON.parse(lastCall)
    expect(parsed).toHaveProperty('packages')
    expect(parsed).toHaveProperty('totalErrors')
  })

  it('handles error during workspace check', async () => {
    vi.mocked(workspace.detectWorkspace).mockImplementation(() => {
      throw new Error('Workspace detection failed')
    })

    const result = await runCheck({ all: true })

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(1)
  })
})
