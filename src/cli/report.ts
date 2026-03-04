/**
 * layerguard report command
 *
 * Generates HTML reports from check results or historical data
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { loadConfig } from '../config/loader.js'
import { validateConfig } from '../config/validator.js'
import { buildDependencyGraphIncremental } from '../parser/incremental.js'
import { createFlowChecker } from '../enforcer/checker.js'
import { detectCircularDependencies } from '../enforcer/circular.js'
import { createViolationReport, type Violation, type ViolationReport } from '../enforcer/violations.js'
import { formatError, formatSuccess } from '../output/terminal.js'
import { generateHtmlReport, generateMarkdownSummary, type HistoricalDataPoint } from '../output/html.js'
import { getPlugin } from '../plugins/registry.js'

/**
 * Options for the report command
 */
export interface ReportCommandOptions {
  /**
   * Project root directory
   */
  cwd?: string

  /**
   * Output file path (default: layerguard-report.html)
   */
  output?: string

  /**
   * Output format
   */
  format?: 'html' | 'markdown'

  /**
   * Path to historical JSON files for trend analysis
   */
  from?: string

  /**
   * Whether to include type-only imports
   */
  typeOnlyImports?: boolean

  /**
   * Disable colors in console output
   */
  noColors?: boolean

  /**
   * Report title
   */
  title?: string

  /**
   * Open in browser after generating
   */
  open?: boolean

  /**
   * Output to stdout instead of file
   */
  stdout?: boolean
}

/**
 * Result of the report command
 */
export interface ReportResult {
  /**
   * Whether the report was generated successfully
   */
  success: boolean

  /**
   * Path to the generated report
   */
  outputPath?: string

  /**
   * Error message if failed
   */
  error?: string
}

/**
 * Run the report command
 */
export async function runReport(options: ReportCommandOptions = {}): Promise<ReportResult> {
  const {
    cwd = process.cwd(),
    output = 'layerguard-report.html',
    format = 'html',
    from,
    typeOnlyImports = false,
    noColors = false,
    title = 'Layerguard Report',
    stdout = false,
  } = options

  try {
    // Load historical data if provided
    const history: HistoricalDataPoint[] = from ? loadHistoricalData(from) : []

    // Load and validate config
    const loadedConfig = await loadConfig(cwd)

    const validation = validateConfig(loadedConfig.config, cwd)
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => e.message).join('\n')
      console.error(formatError(`Invalid config at ${loadedConfig.configPath}:\n${errorMessages}`, { colors: !noColors }))
      return { success: false, error: 'Invalid configuration' }
    }

    // Get plugin for framework-specific ignore patterns
    const plugin = loadedConfig.config.framework ? getPlugin(loadedConfig.config.framework) : undefined
    const pluginIgnorePatterns = plugin?.defaultIgnorePatterns ?? []
    const allIgnorePatterns = [...(loadedConfig.config.ignore ?? []), ...pluginIgnorePatterns]

    // Build dependency graph
    const buildOptions: Parameters<typeof buildDependencyGraphIncremental>[0] = {
      projectRoot: cwd,
      config: loadedConfig.config,
      includeTypeOnlyImports: typeOnlyImports || loadedConfig.config.rules?.typeOnlyImports === 'enforce',
      useCache: true,
    }
    if (allIgnorePatterns.length > 0) {
      buildOptions.ignore = allIgnorePatterns
    }
    const buildResult = buildDependencyGraphIncremental(buildOptions)
    const graph = buildResult.graph

    const stats = {
      fileCount: graph.files.size,
      importCount: graph.edges.length,
    }

    // Run flow checker
    const checker = createFlowChecker(loadedConfig.config)
    const checkOptions: Parameters<typeof checker.checkGraph>[1] = {
      unmappedSeverity: 'warn',
      unlayeredImports: loadedConfig.config.rules?.unlayeredImports ?? 'ignore',
      barrelResolution: loadedConfig.config.rules?.barrelResolution ?? 'import-site',
      projectRoot: cwd,
    }
    if (loadedConfig.config.rules?.maxImportDepth !== undefined) {
      checkOptions.maxImportDepth = loadedConfig.config.rules.maxImportDepth
    }
    if (loadedConfig.config.rules?.maxImportsPerFile !== undefined) {
      checkOptions.maxImportsPerFile = loadedConfig.config.rules.maxImportsPerFile
    }
    const flowViolations = checker.checkGraph(graph, checkOptions)

    // Run circular dependency detection
    const circularSeverity = loadedConfig.config.rules?.circular ?? 'error'
    let circularViolations: Violation[] = []
    if (circularSeverity !== 'off') {
      const circularResult = detectCircularDependencies(graph, circularSeverity)
      circularViolations = circularResult.violations
    }

    // Combine all violations
    const allViolations = [...flowViolations, ...circularViolations]
    const report = createViolationReport(allViolations)

    // Generate report based on format
    let content: string
    if (format === 'markdown') {
      content = generateMarkdownSummary(report, { showDetails: true })
    } else {
      content = generateHtmlReport(report, {
        title,
        projectName: getProjectName(cwd),
        history,
        config: loadedConfig.config,
        stats,
      })
    }

    // Output
    if (stdout) {
      console.log(content)
    } else {
      const outputPath = output.startsWith('/') || output.startsWith('\\') || output.includes(':')
        ? output
        : join(cwd, output)

      // Create directory if needed
      const outputDir = dirname(outputPath)
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }

      writeFileSync(outputPath, content, 'utf-8')
      console.log(formatSuccess(`Report generated: ${outputPath}`, { colors: !noColors }))

      return { success: true, outputPath }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(formatError(message, { colors: !noColors }))
    return { success: false, error: message }
  }
}

/**
 * Load historical data from JSON files
 */
function loadHistoricalData(path: string): HistoricalDataPoint[] {
  const history: HistoricalDataPoint[] = []

  try {
    if (!existsSync(path)) {
      return history
    }

    // Read file(s) from the path
    const content = readFileSync(path, 'utf-8')
    const data = JSON.parse(content)

    // Support both single file and array of results
    if (Array.isArray(data)) {
      for (const item of data) {
        const point = parseHistoricalItem(item)
        if (point) {
          history.push(point)
        }
      }
    } else if (data.history) {
      // Support layerguard-history.json format
      for (const item of data.history) {
        const point = parseHistoricalItem(item)
        if (point) {
          history.push(point)
        }
      }
    } else {
      // Single data point
      const point = parseHistoricalItem(data)
      if (point) {
        history.push(point)
      }
    }
  } catch {
    // Ignore errors reading historical data
  }

  return history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

/**
 * Parse a historical data item
 */
function parseHistoricalItem(item: unknown): HistoricalDataPoint | null {
  if (!item || typeof item !== 'object') {
    return null
  }

  const obj = item as Record<string, unknown>
  const timestamp = obj.timestamp as string || new Date().toISOString()
  const date = obj.date as string || timestamp.split('T')[0] || ''

  // Support both formats: direct counts or nested in report
  let counts: ViolationReport['counts']
  if (obj.counts && typeof obj.counts === 'object') {
    counts = obj.counts as ViolationReport['counts']
  } else if (obj.report && typeof obj.report === 'object') {
    const report = obj.report as { counts?: ViolationReport['counts'] }
    counts = report.counts ?? getDefaultCounts()
  } else {
    counts = getDefaultCounts()
  }

  const result: HistoricalDataPoint = {
    timestamp,
    date,
    counts,
    fileCount: (obj.fileCount as number) ?? 0,
    importCount: (obj.importCount as number) ?? 0,
  }

  if (obj.commitSha && typeof obj.commitSha === 'string') {
    result.commitSha = obj.commitSha
  }
  if (obj.branch && typeof obj.branch === 'string') {
    result.branch = obj.branch
  }

  return result
}

/**
 * Get default violation counts
 */
function getDefaultCounts(): ViolationReport['counts'] {
  return {
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
  }
}

/**
 * Get project name from directory
 */
function getProjectName(cwd: string): string {
  try {
    const packageJsonPath = join(cwd, 'package.json')
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      return packageJson.name || cwd.split(/[/\\]/).pop() || 'Project'
    }
  } catch {
    // Ignore
  }
  return cwd.split(/[/\\]/).pop() || 'Project'
}

/**
 * Save check results for historical tracking
 */
export function saveCheckResult(report: ViolationReport, options: {
  outputPath: string
  commitSha?: string
  branch?: string
  fileCount?: number
  importCount?: number
}): void {
  const { outputPath, commitSha, branch, fileCount = 0, importCount = 0 } = options

  const dataPoint: HistoricalDataPoint = {
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0] ?? '',
    counts: report.counts,
    fileCount,
    importCount,
  }

  if (commitSha) {
    dataPoint.commitSha = commitSha
  }
  if (branch) {
    dataPoint.branch = branch
  }

  let history: HistoricalDataPoint[] = []

  // Load existing history
  if (existsSync(outputPath)) {
    try {
      const content = readFileSync(outputPath, 'utf-8')
      const data = JSON.parse(content)
      if (data.history && Array.isArray(data.history)) {
        history = data.history
      }
    } catch {
      // Start fresh
    }
  }

  // Add new data point
  history.push(dataPoint)

  // Keep only last 100 entries
  if (history.length > 100) {
    history = history.slice(-100)
  }

  // Create directory if needed
  const dir = dirname(outputPath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  // Save
  writeFileSync(outputPath, JSON.stringify({ history }, null, 2), 'utf-8')
}
