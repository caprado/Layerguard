/**
 * Tests for CLI report command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { LayerguardConfig } from '../../../src/config/types.js'
import type { DependencyGraph } from '../../../src/parser/graph.js'
import type { IncrementalBuildResult } from '../../../src/parser/incremental.js'
import type { ViolationReport } from '../../../src/enforcer/violations.js'

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => '{}'),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}))

vi.mock('../../../src/config/loader.js')
vi.mock('../../../src/parser/incremental.js')

import { runReport, saveCheckResult } from '../../../src/cli/report.js'
import * as loader from '../../../src/config/loader.js'
import * as incrementalBuilder from '../../../src/parser/incremental.js'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'

describe('runReport', () => {
  const mockConfig: LayerguardConfig = {
    layers: {
      components: { path: 'src/components' },
      hooks: { path: 'src/hooks' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> hooks', 'hooks -> utils', 'components -> utils'],
  }

  const mockEmptyGraph: DependencyGraph = {
    projectRoot: '/project',
    files: new Set(['src/components/Button.ts', 'src/hooks/useData.ts']),
    adjacencyList: new Map(),
    edges: [],
    parseErrors: new Map(),
    unresolvedImports: [],
    externalImports: new Set(),
  }

  const mockBuildResult: IncrementalBuildResult = {
    graph: mockEmptyGraph,
    cacheHit: false,
    filesParsed: 2,
    totalFiles: 2,
    duration: 10,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })
    vi.mocked(incrementalBuilder.buildDependencyGraphIncremental).mockReturnValue(mockBuildResult)
    vi.mocked(existsSync).mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns success: true when report is generated', async () => {
    const result = await runReport({ cwd: '/project' })

    expect(result.success).toBe(true)
    expect(result.outputPath).toBeDefined()
  })

  it('outputs HTML by default', async () => {
    await runReport({ cwd: '/project' })

    expect(writeFileSync).toHaveBeenCalled()
    const content = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string
    expect(content).toContain('<!DOCTYPE html>')
  })

  it('outputs markdown when format is markdown', async () => {
    await runReport({ cwd: '/project', format: 'markdown' })

    expect(writeFileSync).toHaveBeenCalled()
    const content = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string
    expect(content).toContain('#')
    expect(content).not.toContain('<!DOCTYPE html>')
  })

  it('outputs to stdout when stdout option is true', async () => {
    const result = await runReport({ cwd: '/project', stdout: true })

    expect(result.success).toBe(true)
    expect(result.outputPath).toBeUndefined()
    expect(console.log).toHaveBeenCalled()
  })

  it('handles config load errors', async () => {
    vi.mocked(loader.loadConfig).mockRejectedValue(new Error('Config not found'))

    const result = await runReport()

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('handles invalid config', async () => {
    const invalidConfig: LayerguardConfig = {
      layers: {
        invalid: { path: '' },
      },
      flow: [],
    }

    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: invalidConfig,
      configPath: 'layerguard.config.ts',
    })

    const result = await runReport()

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid configuration')
  })

  it('uses custom output path', async () => {
    await runReport({ output: 'custom-report.html' })

    const outputPath = vi.mocked(writeFileSync).mock.calls[0]?.[0] as string
    expect(outputPath).toContain('custom-report.html')
  })

  it('creates output directory if needed', async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    await runReport({ output: 'reports/layerguard-report.html' })

    expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true })
  })

  it('uses custom title', async () => {
    await runReport({ title: 'My Custom Report' })

    const content = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string
    expect(content).toContain('My Custom Report')
  })

  it('respects typeOnlyImports option', async () => {
    await runReport({ typeOnlyImports: true })

    expect(incrementalBuilder.buildDependencyGraphIncremental).toHaveBeenCalledWith(
      expect.objectContaining({
        includeTypeOnlyImports: true,
      })
    )
  })

  it('loads historical data from --from option with array format', async () => {
    const historicalData = JSON.stringify([
      {
        timestamp: '2024-01-01T00:00:00Z',
        counts: { total: 5, flow: 1 },
        fileCount: 100,
      },
    ])

    vi.mocked(readFileSync).mockReturnValue(historicalData)

    const result = await runReport({ cwd: '/project', from: 'history.json' })

    expect(result.success).toBe(true)
    expect(readFileSync).toHaveBeenCalledWith('history.json', 'utf-8')
  })

  it('loads historical data with history array format', async () => {
    const historicalData = JSON.stringify({
      history: [
        {
          timestamp: '2024-01-01T00:00:00Z',
          date: '2024-01-01',
          counts: { total: 5 },
          fileCount: 100,
        },
      ],
    })

    vi.mocked(readFileSync).mockReturnValue(historicalData)

    const result = await runReport({ cwd: '/project', from: 'layerguard-history.json' })

    expect(result.success).toBe(true)
  })

  it('loads single historical data point', async () => {
    const singlePoint = JSON.stringify({
      timestamp: '2024-01-01T00:00:00Z',
      counts: { total: 3 },
      fileCount: 50,
    })

    vi.mocked(readFileSync).mockReturnValue(singlePoint)

    const result = await runReport({ cwd: '/project', from: 'single.json' })

    expect(result.success).toBe(true)
  })

  it('handles missing historical data file gracefully', async () => {
    vi.mocked(existsSync).mockImplementation((p: string) => {
      if (String(p).includes('history')) return false
      return true
    })

    const result = await runReport({ cwd: '/project', from: 'missing-history.json' })

    expect(result.success).toBe(true)
  })

  it('handles historical data with nested report format', async () => {
    const nestedData = JSON.stringify([
      {
        timestamp: '2024-01-01T00:00:00Z',
        report: {
          counts: { total: 5, flow: 2 },
        },
        fileCount: 100,
      },
    ])

    vi.mocked(readFileSync).mockReturnValue(nestedData)

    const result = await runReport({ cwd: '/project', from: 'nested.json' })

    expect(result.success).toBe(true)
  })

  it('handles invalid historical data items gracefully', async () => {
    const mixedData = JSON.stringify([
      null,
      { timestamp: '2024-01-01T00:00:00Z', counts: { total: 1 } },
      'invalid',
      { timestamp: '2024-01-02T00:00:00Z', counts: { total: 2 } },
    ])

    vi.mocked(readFileSync).mockReturnValue(mixedData)

    const result = await runReport({ cwd: '/project', from: 'mixed.json' })

    expect(result.success).toBe(true)
  })

  it('handles corrupted historical data file gracefully', async () => {
    vi.mocked(readFileSync).mockReturnValue('not valid json {{{')

    const result = await runReport({ cwd: '/project', from: 'corrupted.json' })

    expect(result.success).toBe(true)
  })
})

describe('saveCheckResult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockReport: ViolationReport = {
    passed: true,
    counts: {
      flow: 0,
      isolation: 0,
      circular: 0,
      unmapped: 0,
      unlayered: 0,
      orphan: 0,
      depth: 0,
      publicApi: 0,
      dependentBudget: 0,
      importCount: 0,
      total: 0,
    },
    violations: [],
    severityCounts: {
      error: 0,
      warn: 0,
    },
  }

  it('creates new history file if none exists', () => {
    vi.mocked(existsSync).mockReturnValue(false)

    saveCheckResult(mockReport, { outputPath: 'reports/history.json' })

    expect(mkdirSync).toHaveBeenCalled()
    expect(writeFileSync).toHaveBeenCalled()
    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string)
    expect(written.history).toHaveLength(1)
  })

  it('appends to existing history file', () => {
    const existingHistory = JSON.stringify({
      history: [
        {
          timestamp: '2024-01-01T00:00:00Z',
          date: '2024-01-01',
          counts: { total: 5 },
          fileCount: 10,
          importCount: 20,
        },
      ],
    })

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(existingHistory)

    saveCheckResult(mockReport, { outputPath: 'history.json' })

    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string)
    expect(written.history).toHaveLength(2)
  })

  it('includes commit and branch info when provided', () => {
    vi.mocked(existsSync).mockReturnValue(false)

    saveCheckResult(mockReport, {
      outputPath: 'history.json',
      commitSha: 'abc123',
      branch: 'main',
      fileCount: 100,
      importCount: 500,
    })

    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string)
    expect(written.history[0].commitSha).toBe('abc123')
    expect(written.history[0].branch).toBe('main')
    expect(written.history[0].fileCount).toBe(100)
    expect(written.history[0].importCount).toBe(500)
  })

  it('limits history to 100 entries', () => {
    const existingHistory = JSON.stringify({
      history: Array.from({ length: 100 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        counts: { total: i },
        fileCount: 10,
        importCount: 20,
      })),
    })

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(existingHistory)

    saveCheckResult(mockReport, { outputPath: 'history.json' })

    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string)
    expect(written.history).toHaveLength(100)
  })

  it('handles corrupted history file gracefully', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue('not valid json')

    saveCheckResult(mockReport, { outputPath: 'history.json' })

    const written = JSON.parse(vi.mocked(writeFileSync).mock.calls[0]?.[1] as string)
    expect(written.history).toHaveLength(1)
  })
})
