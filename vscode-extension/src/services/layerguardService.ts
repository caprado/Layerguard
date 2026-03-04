/**
 * Layerguard Service
 *
 * Wraps layerguard functionality for use in VS Code extension.
 * Uses hybrid loading: prefers workspace-installed layerguard, falls back to bundled.
 */

import * as vscode from 'vscode'
import * as path from 'path'
import { pathToFileURL } from 'url'

// Type imports (these are safe - just type definitions)
import type { LayerguardConfig, LayerConfig, ParsedFlowRule } from 'layerguard/config'
import type { DependencyGraph } from 'layerguard/parser'
import type { Violation, LayerMapper, ViolationSeverity } from 'layerguard/enforcer'

// Layerguard module interfaces
interface LayerguardModules {
  loadConfig: (cwd: string) => Promise<{ config: LayerguardConfig; configPath: string }>
  validateConfig: (config: LayerguardConfig, cwd: string) => { valid: boolean; errors: Array<{ message: string }> }
  parseFlowRules: (rules: string[]) => ParsedFlowRule[]
  buildDependencyGraphIncremental: (options: {
    projectRoot: string
    config: LayerguardConfig
    includeTypeOnlyImports?: boolean
    useCache?: boolean
    ignore?: string[]
  }) => { graph: DependencyGraph; cacheHit: boolean; filesParsed: number }
  createFlowChecker: (config: LayerguardConfig) => {
    checkGraph: (graph: DependencyGraph, options: Record<string, unknown>) => Violation[]
  }
  detectCircularDependencies: (graph: DependencyGraph, severity?: ViolationSeverity) => { violations: Violation[] }
  createLayerMapper: (config: LayerguardConfig) => LayerMapper
  getPlugin: (framework: string) => { defaultIgnorePatterns?: string[] } | undefined
}

let cachedModules: LayerguardModules | undefined
let cachedWorkspaceRoot: string | undefined

/**
 * Load layerguard modules - prefers workspace version, falls back to bundled
 */
async function loadLayerguardModules(workspaceRoot: string): Promise<LayerguardModules> {
  // Return cached modules if same workspace
  if (cachedModules && cachedWorkspaceRoot === workspaceRoot) {
    console.log('Layerguard: Using cached modules')
    return cachedModules
  }

  // Try workspace-installed layerguard first
  try {
    const workspaceLayerguardPath = path.join(workspaceRoot, 'node_modules', 'layerguard')
    console.log('Layerguard: Trying workspace path:', workspaceLayerguardPath)

    // Convert to file:// URL for Windows compatibility
    const baseUrl = pathToFileURL(workspaceLayerguardPath).href

    // Dynamic imports for workspace version
    const configModule = await import(`${baseUrl}/dist/config/index.js`)
    const parserModule = await import(`${baseUrl}/dist/parser/index.js`)
    const enforcerModule = await import(`${baseUrl}/dist/enforcer/index.js`)
    const pluginsModule = await import(`${baseUrl}/dist/plugins/index.js`)

    console.log('Layerguard: Using workspace-installed version')

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
    console.log('Layerguard: Workspace layerguard not found, falling back to bundled')
    console.log('Layerguard: Error was:', error instanceof Error ? error.message : error)
  }

  // Import bundled version
  console.log('Layerguard: Loading bundled modules...')
  const configModule = await import('layerguard/config')
  const parserModule = await import('layerguard/parser')
  const enforcerModule = await import('layerguard/enforcer')
  const pluginsModule = await import('layerguard/plugins')
  console.log('Layerguard: Bundled modules loaded')

  const modules: LayerguardModules = {
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
 * Result of running layerguard check
 */
export interface CheckResult {
  violations: Violation[]
  passed: boolean
  graph: DependencyGraph
}

/**
 * Service for interacting with layerguard
 */
export class LayerguardService {
  private config: LayerguardConfig | undefined
  private configPath: string | undefined
  private mapper: LayerMapper | undefined
  private graph: DependencyGraph | undefined
  private parsedFlows: ParsedFlowRule[] = []
  private workspaceRoot: string
  private modules: LayerguardModules | undefined

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
  }

  /**
   * Load the layerguard configuration
   */
  async loadConfiguration(): Promise<boolean> {
    try {
      // Load modules (workspace or bundled)
      this.modules = await loadLayerguardModules(this.workspaceRoot)

      const result = await this.modules.loadConfig(this.workspaceRoot)
      this.config = result.config
      this.configPath = result.configPath

      const validation = this.modules.validateConfig(this.config, this.workspaceRoot)
      if (!validation.valid) {
        vscode.window.showErrorMessage(
          `Invalid layerguard config: ${validation.errors.map((e: { message: string }) => e.message).join(', ')}`
        )
        return false
      }

      this.mapper = this.modules.createLayerMapper(this.config)
      this.parsedFlows = this.modules.parseFlowRules(this.config.flow)
      console.log('Layerguard: Config loaded successfully from', this.configPath)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Layerguard: Failed to load config:', message)
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
  getConfig(): LayerguardConfig | undefined {
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
    console.log('Layerguard: check() called, hasConfig:', !!this.config, 'hasModules:', !!this.modules)
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
        config: LayerguardConfig
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

      console.log('Layerguard: check() found', allViolations.length, 'violations')
      if (allViolations.length > 0) {
        console.log('Layerguard: violation files:', allViolations.map(v => v.sourceFile))
      }

      return {
        violations: allViolations,
        passed: !hasErrors,
        graph: this.graph,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log('Layerguard: check() error:', message)
      vscode.window.showErrorMessage(`Layerguard check failed: ${message}`)
      return undefined
    }
  }

  /**
   * Get violations for a specific file
   */
  async getViolationsForFile(filePath: string): Promise<Violation[]> {
    const result = await this.check()
    if (!result) {
      console.log('Layerguard: check() returned no result')
      return []
    }

    // Convert absolute path to relative for comparison
    const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/')
    console.log('Layerguard: Looking for violations in:', relativePath)
    console.log('Layerguard: Total violations:', result.violations.length)
    console.log('Layerguard: Violation files:', result.violations.map(v => v.sourceFile))

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
let serviceInstance: LayerguardService | undefined

/**
 * Get or create the layerguard service
 */
export function getLayerguardService(workspaceRoot: string): LayerguardService {
  if (!serviceInstance || serviceInstance['workspaceRoot'] !== workspaceRoot) {
    serviceInstance = new LayerguardService(workspaceRoot)
  }
  return serviceInstance
}

/**
 * Clear the service instance (for testing or workspace changes)
 */
export function clearLayerguardService(): void {
  serviceInstance = undefined
}
