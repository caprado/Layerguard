/**
 * Flow enforcement engine
 *
 * Checks every dependency edge against the flow rules
 */

import { join } from 'node:path'
import type { LayerguardConfig } from '../config/types.js'
import type { FlowGraph } from '../config/types.js'
import { parseFlowRules, buildFlowGraph, canImport } from '../config/parser.js'
import type { DependencyGraph, DependencyEdge } from '../parser/graph.js'
import { getDependents } from '../parser/graph.js'
import { LayerMapper, type LayerMapping } from './mapper.js'
import {
  createFlowViolation,
  createIsolationViolation,
  createUnmappedViolation,
  createUnlayeredViolation,
  createOrphanViolation,
  type Violation,
  type ViolationSeverity,
} from './violations.js'
import { checkAdvancedRules, type AdvancedRulesOptions } from './advanced-rules.js'
import type { FrameworkPlugin } from '../plugins/types.js'
import { getPlugin } from '../plugins/registry.js'
import {
  resolveBarrelOrigins,
  isLikelyBarrelFile,
  clearBarrelCache,
} from '../parser/barrel.js'
import { createResolverContext, toRelativePath } from '../parser/resolver.js'

/**
 * Options for flow checking
 */
export interface CheckOptions {
  /**
   * Severity for unmapped file violations
   * @default 'warn'
   */
  unmappedSeverity?: ViolationSeverity

  /**
   * Whether to check sublayer flow rules
   * @default true
   */
  checkSublayerFlow?: boolean

  /**
   * Whether to check feature isolation
   * @default true
   */
  checkIsolation?: boolean

  /**
   * How to handle imports from layered files to unlayered files
   * - 'ignore' (default): no violations
   * - 'warn': violations with warning severity
   * - 'error': violations with error severity
   * @default 'ignore'
   */
  unlayeredImports?: 'error' | 'warn' | 'ignore'

  /**
   * How to resolve import targets when checking layer boundaries.
   * - 'import-site' (default): check against where the import statement points
   * - 'origin': trace re-exports to their origin file and check against that
   * @default 'import-site'
   */
  barrelResolution?: 'import-site' | 'origin'

  /**
   * Project root (needed for barrel resolution in origin mode)
   */
  projectRoot?: string

  /**
   * Maximum allowed depth of import chains.
   * When set, flags import chains that exceed this depth.
   */
  maxImportDepth?: number

  /**
   * Maximum allowed imports per file.
   * When set, flags files that import from too many places.
   */
  maxImportsPerFile?: number

  /**
   * How to handle orphan files (files not imported by any other file)
   * - 'off' (default): no orphan detection
   * - 'warn': orphan files produce warnings
   * - 'error': orphan files produce errors
   * @default 'off'
   */
  orphans?: 'error' | 'warn' | 'off'
}

/**
 * Result of checking a single edge
 */
export interface EdgeCheckResult {
  /**
   * The edge that was checked
   */
  edge: DependencyEdge

  /**
   * Source file mapping
   */
  sourceMapping: LayerMapping | null

  /**
   * Target file mapping
   */
  targetMapping: LayerMapping | null

  /**
   * Whether the edge is allowed
   */
  allowed: boolean

  /**
   * Violation if not allowed
   */
  violation?: Violation
}

/**
 * Flow checker instance
 */
export class FlowChecker {
  private config: LayerguardConfig
  private mapper: LayerMapper
  private topLevelFlowGraph: FlowGraph
  private sublayerFlowGraphs: Map<string, FlowGraph> = new Map()
  private plugin: FrameworkPlugin | undefined

  constructor(config: LayerguardConfig) {
    this.config = config
    this.mapper = new LayerMapper(config)

    // Load framework plugin if specified
    if (config.framework) {
      this.plugin = getPlugin(config.framework)
    }

    // Build top-level flow graph
    const parsedRules = parseFlowRules(config.flow)
    this.topLevelFlowGraph = buildFlowGraph(parsedRules)

    // Build sublayer flow graphs for each layer that has them
    for (const [layerName, layerConfig] of Object.entries(config.layers)) {
      if (layerConfig.flow && layerConfig.sublayers) {
        const sublayerRules = parseFlowRules(layerConfig.flow)
        this.sublayerFlowGraphs.set(layerName, buildFlowGraph(sublayerRules))
      }
    }
  }

  /**
   * Get the active plugin
   */
  getPlugin(): FrameworkPlugin | undefined {
    return this.plugin
  }

  /**
   * Check if a file should be ignored by the plugin
   */
  shouldIgnoreFile(filePath: string): boolean {
    return this.plugin?.shouldIgnore?.(filePath) ?? false
  }

  /**
   * Check if a file is implicitly used by the framework
   */
  isImplicitlyUsed(filePath: string): boolean {
    return this.plugin?.isImplicitlyUsed?.(filePath) ?? false
  }

  /**
   * Normalize a file path using the plugin
   */
  normalizePath(filePath: string): string {
    return this.plugin?.normalizePath?.(filePath) ?? filePath
  }

  /**
   * Check if an import from source to target is allowed
   */
  checkEdge(edge: DependencyEdge, options: CheckOptions = {}): EdgeCheckResult {
    const {
      unmappedSeverity = 'warn',
      checkSublayerFlow = true,
      checkIsolation = true,
      unlayeredImports = 'ignore',
    } = options

    const sourceMapping = this.mapper.map(edge.source)
    const targetMapping = this.mapper.map(edge.target)

    // If source is unmapped, create a warning
    if (!sourceMapping) {
      return {
        edge,
        sourceMapping: null,
        targetMapping,
        allowed: false,
        violation: createUnmappedViolation({
          sourceFile: edge.source,
          severity: unmappedSeverity,
        }),
      }
    }

    // If target is unmapped, check unlayeredImports policy
    if (!targetMapping) {
      if (unlayeredImports !== 'ignore') {
        return {
          edge,
          sourceMapping,
          targetMapping: null,
          allowed: false,
          violation: createUnlayeredViolation({
            sourceFile: edge.source,
            targetFile: edge.target,
            sourceLayer: sourceMapping.layer,
            importSpecifier: edge.specifier,
            line: edge.line,
            severity: unlayeredImports,
          }),
        }
      }
      return {
        edge,
        sourceMapping,
        targetMapping: null,
        allowed: true,
      }
    }

    // Same layer, same sublayer - always allowed
    if (
      sourceMapping.layer === targetMapping.layer &&
      sourceMapping.sublayer === targetMapping.sublayer
    ) {
      // But check isolation if both are in same isolated sublayer with different features
      if (
        checkIsolation &&
        sourceMapping.isIsolated &&
        sourceMapping.feature &&
        targetMapping.feature &&
        sourceMapping.feature !== targetMapping.feature
      ) {
        return {
          edge,
          sourceMapping,
          targetMapping,
          allowed: false,
          violation: createIsolationViolation({
            sourceFile: edge.source,
            targetFile: edge.target,
            sourceLayer: sourceMapping.layer,
            sourceSublayer: sourceMapping.sublayer!,
            targetSublayer: targetMapping.sublayer!,
            sourceFeature: sourceMapping.feature,
            targetFeature: targetMapping.feature,
            importSpecifier: edge.specifier,
            line: edge.line,
          }),
        }
      }

      return {
        edge,
        sourceMapping,
        targetMapping,
        allowed: true,
      }
    }

    // Same layer, different sublayers - check sublayer flow rules
    if (sourceMapping.layer === targetMapping.layer && sourceMapping.sublayer !== targetMapping.sublayer) {
      if (checkSublayerFlow && sourceMapping.sublayer && targetMapping.sublayer) {
        const sublayerGraph = this.sublayerFlowGraphs.get(sourceMapping.layer)

        if (sublayerGraph) {
          const allowed = canImport(sublayerGraph, sourceMapping.sublayer, targetMapping.sublayer)

          if (!allowed) {
            return {
              edge,
              sourceMapping,
              targetMapping,
              allowed: false,
              violation: createFlowViolation({
                sourceFile: edge.source,
                targetFile: edge.target,
                sourceLayer: `${sourceMapping.layer}/${sourceMapping.sublayer}`,
                targetLayer: `${targetMapping.layer}/${targetMapping.sublayer}`,
                importSpecifier: edge.specifier,
                line: edge.line,
              }),
            }
          }
        }
      }

      // If no sublayer flow rules defined, allow intra-layer imports
      return {
        edge,
        sourceMapping,
        targetMapping,
        allowed: true,
      }
    }

    // Different layers - check top-level flow rules
    const allowed = canImport(this.topLevelFlowGraph, sourceMapping.layer, targetMapping.layer)

    if (!allowed) {
      return {
        edge,
        sourceMapping,
        targetMapping,
        allowed: false,
        violation: createFlowViolation({
          sourceFile: edge.source,
          targetFile: edge.target,
          sourceLayer: sourceMapping.layer,
          targetLayer: targetMapping.layer,
          importSpecifier: edge.specifier,
          line: edge.line,
        }),
      }
    }

    return {
      edge,
      sourceMapping,
      targetMapping,
      allowed: true,
    }
  }

  /**
   * Check all edges in a dependency graph
   */
  checkGraph(graph: DependencyGraph, options: CheckOptions = {}): Violation[] {
    const violations: Violation[] = []
    const { barrelResolution = 'import-site', projectRoot, maxImportDepth, maxImportsPerFile } = options

    // Track unmapped files to avoid duplicate violations
    const reportedUnmappedFiles = new Set<string>()

    // Create resolver context if we need origin resolution
    const resolverContext =
      barrelResolution === 'origin' && projectRoot
        ? createResolverContext(projectRoot)
        : null

    // Clear barrel cache at start of check
    if (barrelResolution === 'origin') {
      clearBarrelCache()
    }

    for (const edge of graph.edges) {
      // Handle barrel resolution in origin mode
      if (barrelResolution === 'origin' && resolverContext) {
        const absoluteTarget = join(graph.projectRoot, edge.target)

        // Only trace barrels for likely barrel files (index.ts etc)
        if (isLikelyBarrelFile(edge.target)) {
          const origins = resolveBarrelOrigins(absoluteTarget, resolverContext)

          // Check each origin
          for (const originPath of origins) {
            const originRelative = toRelativePath(originPath, graph.projectRoot)

            // Skip if origin is same as original target (not a re-export)
            if (originRelative === edge.target) {
              continue
            }

            // Create a modified edge with the origin as target
            const originEdge: DependencyEdge = {
              ...edge,
              target: originRelative,
            }

            const result = this.checkEdge(originEdge, options)
            if (!result.allowed && result.violation) {
              violations.push(result.violation)
            }
          }
        }
      }

      // Always check the import-site edge
      const result = this.checkEdge(edge, options)
      if (!result.allowed && result.violation) {
        // Deduplicate unmapped file violations
        if (result.violation.type === 'unmapped') {
          if (reportedUnmappedFiles.has(edge.source)) {
            continue
          }
          reportedUnmappedFiles.add(edge.source)
        }
        violations.push(result.violation)
      }
    }

    // Check advanced rules
    const advancedOptions: AdvancedRulesOptions = {}
    if (maxImportDepth !== undefined) {
      advancedOptions.maxImportDepth = maxImportDepth
    }
    if (maxImportsPerFile !== undefined) {
      advancedOptions.maxImportsPerFile = maxImportsPerFile
    }

    const advancedViolations = checkAdvancedRules(graph, this.config, this.mapper, advancedOptions)
    violations.push(...advancedViolations)

    // Check for orphan files if enabled
    const orphanSetting = options.orphans ?? 'off'
    if (orphanSetting !== 'off') {
      const orphanViolations = this.checkOrphans(graph, orphanSetting)
      violations.push(...orphanViolations)
    }

    return violations
  }

  /**
   * Check for orphan files (files not imported by any other file)
   */
  private checkOrphans(
    graph: DependencyGraph,
    severity: 'error' | 'warn'
  ): Violation[] {
    const violations: Violation[] = []

    for (const file of graph.files) {
      // Skip if file is imported by others
      const dependents = getDependents(graph, file)
      if (dependents.length > 0) {
        continue
      }

      // Skip if framework plugin says file is implicitly used
      if (this.isImplicitlyUsed(file)) {
        continue
      }

      // Skip common entry point patterns
      if (this.isLikelyEntryPoint(file)) {
        continue
      }

      // Get layer info for the violation
      const mapping = this.mapper.map(file)

      violations.push(
        createOrphanViolation({
          sourceFile: file,
          ...(mapping?.layer !== undefined ? { layer: mapping.layer } : {}),
          severity,
        })
      )
    }

    return violations
  }

  /**
   * Check if a file is likely an entry point
   */
  private isLikelyEntryPoint(filePath: string): boolean {
    const entryPatterns = [
      /^src\/index\.[jt]sx?$/,
      /^src\/main\.[jt]sx?$/,
      /^src\/app\.[jt]sx?$/,
      /^index\.[jt]sx?$/,
      /^main\.[jt]sx?$/,
      /\.config\.[jt]s$/,
      /\.test\.[jt]sx?$/,
      /\.spec\.[jt]sx?$/,
    ]
    return entryPatterns.some((pattern) => pattern.test(filePath))
  }

  /**
   * Get the layer mapper
   */
  getMapper(): LayerMapper {
    return this.mapper
  }
}

/**
 * Create a flow checker from config
 */
export function createFlowChecker(config: LayerguardConfig): FlowChecker {
  return new FlowChecker(config)
}

/**
 * Check a dependency graph against a config
 */
export function checkDependencyGraph(
  graph: DependencyGraph,
  config: LayerguardConfig,
  options: CheckOptions = {}
): Violation[] {
  const checker = createFlowChecker(config)
  return checker.checkGraph(graph, options)
}
