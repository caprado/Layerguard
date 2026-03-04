/**
 * Archgate Service
 *
 * Wraps archgate functionality for use in VS Code extension.
 * Uses hybrid loading: prefers workspace-installed archgate, falls back to bundled.
 */

import * as vscode from 'vscode'
import * as path from 'path'
import { pathToFileURL } from 'url'

// Type imports (these are safe - just type definitions)
import type { ArchgateConfig, LayerConfig, ParsedFlowRule } from 'archgate/config'
import type { DependencyGraph } from 'archgate/parser'
import type { Violation, LayerMapper, ViolationSeverity } from 'archgate/enforcer'

// Archgate module interfaces
interface ArchgateModules {
  loadConfig: (cwd: string) => Promise<{ config: ArchgateConfig; configPath: string }>
  validateConfig: (config: ArchgateConfig, cwd: string) => { valid: boolean; errors: Array<{ message: string }> }
  parseFlowRules: (rules: string[]) => ParsedFlowRule[]
  buildDependencyGraphIncremental: (options: {
    projectRoot: string
    config: ArchgateConfig
    includeTypeOnlyImports?: boolean
    useCache?: boolean
    ignore?: string[]
  }) => { graph: DependencyGraph; cacheHit: boolean; filesParsed: number }
  createFlowChecker: (config: ArchgateConfig) => {
    checkGraph: (graph: DependencyGraph, options: Record<string, unknown>) => Violation[]
  }
  detectCircularDependencies: (graph: DependencyGraph, severity?: ViolationSeverity) => { violations: Violation[] }
  createLayerMapper: (config: ArchgateConfig) => LayerMapper
  getPlugin: (framework: string) => { defaultIgnorePatterns?: string[] } | undefined
}

let cachedModules: ArchgateModules | undefined
let cachedWorkspaceRoot: string | undefined

/**
 * Load archgate modules - prefers workspace version, falls back to bundled
 */
async function loadArchgateModules(workspaceRoot: string): Promise<ArchgateModules> {
  // Return cached modules if same workspace
  if (cachedModules && cachedWorkspaceRoot === workspaceRoot) {
    console.log('Archgate: Using cached modules')
    return cachedModules
  }

  // Try workspace-installed archgate first
  try {
    const workspaceArchgatePath = path.join(workspaceRoot, 'node_modules', 'archgate')
    console.log('Archgate: Trying workspace path:', workspaceArchgatePath)

    // Convert to file:// URL for Windows compatibility
    const baseUrl = pathToFileURL(workspaceArchgatePath).href

    // Dynamic imports for workspace version
    const configModule = await import(`${baseUrl}/dist/config/index.js`)
    const parserModule = await import(`${baseUrl}/dist/parser/index.js`)
    const enforcerModule = await import(`${baseUrl}/dist/enforcer/index.js`)
    const pluginsModule = await import(`${baseUrl}/dist/plugins/index.js`)

    console.log('Archgate: Using workspace-installed version')

    cachedModules = {
      loadConfig: configModule.loadConfig,
      validateConfig: configModule.validateConfig,
      parseFlowRules: configModule.parseFlowRules,
      buildDependencyGraphIncremental: parserModule.buildDependencyGraphIncremental,
      createFlowChecker: enforcerModule.createFlowChecker,
      detectCircularDependencies: enforcerModule.detectCircularDependencies,
      createLayerMapper: enforcerModule.createLayerMapper,
      getPlugin: pluginsModule.getPlugin,
    }
    cachedWorkspaceRoot = workspaceRoot
    return cachedModules
  } catch (error) {
    console.log('Archgate: Workspace archgate not found, falling back to bundled')
    console.log('Archgate: Error was:', error instanceof Error ? error.message : error)
  }

  // Import bundled version
  console.log('Archgate: Loading bundled modules...')
  const configModule = await import('archgate/config')
  const parserModule = await import('archgate/parser')
  const enforcerModule = await import('archgate/enforcer')
  const pluginsModule = await import('archgate/plugins')
  console.log('Archgate: Bundled modules loaded')

  const modules: ArchgateModules = {
    loadConfig: configModule.loadConfig,
    validateConfig: configModule.validateConfig,
    parseFlowRules: configModule.parseFlowRules,
    buildDependencyGraphIncremental: parserModule.buildDependencyGraphIncremental,
    createFlowChecker: enforcerModule.createFlowChecker,
    detectCircularDependencies: enforcerModule.detectCircularDependencies,
    createLayerMapper: enforcerModule.createLayerMapper,
    getPlugin: pluginsModule.getPlugin,
  }
  cachedModules = modules
  cachedWorkspaceRoot = workspaceRoot
  return modules
}

/**
 * Result of running archgate check
 */
export interface CheckResult {
  violations: Violation[]
  passed: boolean
  graph: DependencyGraph
}

/**
 * Service for interacting with archgate
 */
export class ArchgateService {
  private config: ArchgateConfig | undefined
  private configPath: string | undefined
  private mapper: LayerMapper | undefined
  private graph: DependencyGraph | undefined
  private parsedFlows: ParsedFlowRule[] = []
  private workspaceRoot: string
  private modules: ArchgateModules | undefined

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
  }

  /**
   * Load the archgate configuration
   */
  async loadConfiguration(): Promise<boolean> {
    try {
      // Load modules (workspace or bundled)
      this.modules = await loadArchgateModules(this.workspaceRoot)

      const result = await this.modules.loadConfig(this.workspaceRoot)
      this.config = result.config
      this.configPath = result.configPath

      const validation = this.modules.validateConfig(this.config, this.workspaceRoot)
      if (!validation.valid) {
        vscode.window.showErrorMessage(
          `Invalid archgate config: ${validation.errors.map((e: { message: string }) => e.message).join(', ')}`
        )
        return false
      }

      this.mapper = this.modules.createLayerMapper(this.config)
      this.parsedFlows = this.modules.parseFlowRules(this.config.flow)
      console.log('Archgate: Config loaded successfully from', this.configPath)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Archgate: Failed to load config:', message)
      console.error(error)
      this.config = undefined
      this.configPath = undefined
      this.mapper = undefined
      this.parsedFlows = []
      this.modules = undefined
      return false
    }
  }

  /**
   * Get the workspace root
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot
  }

  /**
   * Check if configuration is loaded
   */
  hasConfig(): boolean {
    return this.config !== undefined
  }

  /**
   * Get the loaded configuration
   */
  getConfig(): ArchgateConfig | undefined {
    return this.config
  }

  /**
   * Get the config file path
   */
  getConfigPath(): string | undefined {
    return this.configPath
  }

  /**
   * Get the layer mapper
   */
  getMapper(): LayerMapper | undefined {
    return this.mapper
  }

  /**
   * Get parsed flow rules
   */
  getParsedFlows(): ParsedFlowRule[] {
    return this.parsedFlows
  }

  /**
   * Get the layer for a file
   */
  getLayerForFile(filePath: string): string | undefined {
    if (!this.mapper) {
      return undefined
    }
    // Convert absolute path to relative path from workspace root
    const relativePath = path.relative(this.workspaceRoot, filePath)
    const mapping = this.mapper.map(relativePath)
    return mapping?.layer
  }

  /**
   * Run a full check
   */
  async check(): Promise<CheckResult | undefined> {
    console.log('Archgate: check() called, hasConfig:', !!this.config, 'hasModules:', !!this.modules)
    if (!this.config || !this.modules) {
      return undefined
    }

    try {
      // Get plugin for framework-specific ignore patterns
      const plugin = this.config.framework ? this.modules.getPlugin(this.config.framework) : undefined
      const pluginIgnorePatterns = plugin?.defaultIgnorePatterns ?? []
      const allIgnorePatterns = [...(this.config.ignore ?? []), ...pluginIgnorePatterns]

      // Build dependency graph
      const buildOptions: {
        projectRoot: string
        config: ArchgateConfig
        includeTypeOnlyImports?: boolean
        useCache?: boolean
        ignore?: string[]
      } = {
        projectRoot: this.workspaceRoot,
        config: this.config,
        includeTypeOnlyImports: this.config.rules?.typeOnlyImports === 'enforce',
        useCache: true,
      }
      if (allIgnorePatterns.length > 0) {
        buildOptions.ignore = allIgnorePatterns
      }

      const buildResult = this.modules.buildDependencyGraphIncremental(buildOptions)
      this.graph = buildResult.graph

      // Run flow checker
      const checker = this.modules.createFlowChecker(this.config)
      const flowViolations = checker.checkGraph(this.graph, {
        unmappedSeverity: 'warn',
        unlayeredImports: this.config.rules?.unlayeredImports ?? 'ignore',
        barrelResolution: this.config.rules?.barrelResolution ?? 'import-site',
        projectRoot: this.workspaceRoot,
      })

      // Run circular dependency detection
      const circularSeverity = this.config.rules?.circular ?? 'error'
      let circularViolations: Violation[] = []
      if (circularSeverity !== 'off') {
        const circularResult = this.modules.detectCircularDependencies(
          this.graph,
          circularSeverity as ViolationSeverity
        )
        circularViolations = circularResult.violations
      }

      const allViolations = [...flowViolations, ...circularViolations]
      const hasErrors = allViolations.some(v => v.severity === 'error')

      console.log('Archgate: check() found', allViolations.length, 'violations')
      if (allViolations.length > 0) {
        console.log('Archgate: violation files:', allViolations.map(v => v.sourceFile))
      }

      return {
        violations: allViolations,
        passed: !hasErrors,
        graph: this.graph,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log('Archgate: check() error:', message)
      vscode.window.showErrorMessage(`Archgate check failed: ${message}`)
      return undefined
    }
  }

  /**
   * Get violations for a specific file
   */
  async getViolationsForFile(filePath: string): Promise<Violation[]> {
    const result = await this.check()
    if (!result) {
      console.log('Archgate: check() returned no result')
      return []
    }

    // Convert absolute path to relative for comparison
    const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/')
    console.log('Archgate: Looking for violations in:', relativePath)
    console.log('Archgate: Total violations:', result.violations.length)
    console.log('Archgate: Violation files:', result.violations.map(v => v.sourceFile))

    return result.violations.filter(v => v.sourceFile === relativePath)
  }

  /**
   * Check if an import is allowed
   */
  checkImport(sourceFile: string, targetFile: string): {
    allowed: boolean
    sourceLayer?: string
    targetLayer?: string
    reason?: string
  } {
    if (!this.config || !this.mapper) {
      return { allowed: true }
    }

    const sourceMapping = this.mapper.map(sourceFile)
    const targetMapping = this.mapper.map(targetFile)

    if (!sourceMapping || !targetMapping) {
      const result: { allowed: boolean; sourceLayer?: string; targetLayer?: string } = {
        allowed: true,
      }
      if (sourceMapping?.layer) {
        result.sourceLayer = sourceMapping.layer
      }
      if (targetMapping?.layer) {
        result.targetLayer = targetMapping.layer
      }
      return result
    }

    // Check flow rules
    for (const rule of this.parsedFlows) {
      if (rule.from === sourceMapping.layer && rule.to === targetMapping.layer) {
        return {
          allowed: true,
          sourceLayer: sourceMapping.layer,
          targetLayer: targetMapping.layer,
        }
      }
    }

    // If no explicit rule allows it, check if layers are the same
    if (sourceMapping.layer === targetMapping.layer) {
      return {
        allowed: true,
        sourceLayer: sourceMapping.layer,
        targetLayer: targetMapping.layer,
      }
    }

    // No rule found - not allowed
    return {
      allowed: false,
      sourceLayer: sourceMapping.layer,
      targetLayer: targetMapping.layer,
      reason: `No flow rule allows imports from "${sourceMapping.layer}" to "${targetMapping.layer}"`,
    }
  }

  /**
   * Get the dependency graph
   */
  getGraph(): DependencyGraph | undefined {
    return this.graph
  }

  /**
   * Generate architecture diagram text
   */
  generateDiagram(): string {
    if (!this.config) {
      return 'No configuration loaded'
    }

    const layers = Object.keys(this.config.layers)

    let diagram = 'Architecture Layers:\n\n'

    for (const layer of layers) {
      const layerConfig = this.config.layers[layer] as LayerConfig
      const attrs: string[] = []
      if (layerConfig.publicApi) attrs.push('public API')
      if (layerConfig.maxDependents !== undefined) attrs.push(`max ${layerConfig.maxDependents} dependents`)

      diagram += `  [${layer}]`
      if (attrs.length > 0) {
        diagram += ` (${attrs.join(', ')})`
      }
      diagram += `\n    path: ${layerConfig.path}\n\n`
    }

    if (this.parsedFlows.length > 0) {
      diagram += 'Flow Rules:\n\n'
      for (const flow of this.parsedFlows) {
        const arrow = flow.direction === 'bidirectional' ? ' ↔ ' : ' → '
        diagram += `  ${flow.from}${arrow}${flow.to}\n`
      }
    }

    return diagram
  }
}

/**
 * Global service instance
 */
let serviceInstance: ArchgateService | undefined

/**
 * Get or create the archgate service
 */
export function getArchgateService(workspaceRoot: string): ArchgateService {
  if (!serviceInstance || serviceInstance['workspaceRoot'] !== workspaceRoot) {
    serviceInstance = new ArchgateService(workspaceRoot)
  }
  return serviceInstance
}

/**
 * Clear the service instance (for testing or workspace changes)
 */
export function clearArchgateService(): void {
  serviceInstance = undefined
}
