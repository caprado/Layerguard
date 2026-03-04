/**
 * Advanced enforcement rules
 *
 * Implements v2.7 advanced rules:
 * - maxImportDepth: Depth-limited imports
 * - publicApi: Public API enforcement
 * - maxDependents: Layer dependency budget
 * - maxImportsPerFile: Import count limits
 */

import type { LayerguardConfig, LayerConfig } from '../config/types.js'
import type { DependencyGraph } from '../parser/graph.js'
import type { LayerMapper } from './mapper.js'
import {
  createDepthViolation,
  createPublicApiViolation,
  createDependentBudgetViolation,
  createImportCountViolation,
  type Violation,
  type DepthViolation,
  type PublicApiViolation,
  type DependentBudgetViolation,
  type ImportCountViolation,
} from './violations.js'

/**
 * Options for advanced rules checking
 */
export interface AdvancedRulesOptions {
  /**
   * Maximum allowed depth of import chains
   */
  maxImportDepth?: number

  /**
   * Maximum allowed imports per file
   */
  maxImportsPerFile?: number
}

/**
 * Check for import depth violations
 *
 * Finds import chains that exceed the maximum depth.
 * Uses BFS to find the longest path from each file.
 */
export function checkImportDepth(
  graph: DependencyGraph,
  maxDepth: number
): DepthViolation[] {
  const violations: DepthViolation[] = []

  // Build adjacency list for faster lookup
  const adjacency = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }

  // For each file, find the longest import chain starting from it
  const longestChains = new Map<string, string[]>()

  for (const file of graph.files) {
    const chain = findLongestChain(file, adjacency, new Set())
    if (chain.length > maxDepth + 1) {
      // chain includes the source file, so depth = chain.length - 1
      const actualDepth = chain.length - 1
      longestChains.set(file, chain)

      violations.push(
        createDepthViolation({
          sourceFile: file,
          importChain: chain,
          maxDepth,
          actualDepth,
        })
      )
    }
  }

  return violations
}

/**
 * Find the longest import chain starting from a file (DFS with memoization)
 */
function findLongestChain(
  file: string,
  adjacency: Map<string, string[]>,
  visited: Set<string>,
  memo: Map<string, string[]> = new Map()
): string[] {
  // Check memo
  if (memo.has(file)) {
    return memo.get(file)!
  }

  // Avoid cycles
  if (visited.has(file)) {
    return [file]
  }

  visited.add(file)

  const targets = adjacency.get(file) ?? []
  let longestSubchain: string[] = []

  for (const target of targets) {
    const subchain = findLongestChain(target, adjacency, new Set(visited), memo)
    if (subchain.length > longestSubchain.length) {
      longestSubchain = subchain
    }
  }

  const result = [file, ...longestSubchain]
  memo.set(file, result)
  return result
}

/**
 * Check for public API violations
 *
 * When a layer has publicApi configured, only those files can be imported
 * from outside the layer.
 */
export function checkPublicApi(
  graph: DependencyGraph,
  config: LayerguardConfig,
  mapper: LayerMapper
): PublicApiViolation[] {
  const violations: PublicApiViolation[] = []

  // Build map of layer -> public API files (normalized paths)
  const publicApiMap = new Map<string, Set<string>>()

  for (const [layerName, layerConfig] of Object.entries(config.layers)) {
    if (layerConfig.publicApi) {
      const apiFiles = Array.isArray(layerConfig.publicApi)
        ? layerConfig.publicApi
        : [layerConfig.publicApi]

      // Normalize paths relative to layer path
      const normalizedPaths = new Set<string>()
      const layerPath = layerConfig.path.replace(/\/$/, '')

      for (const apiFile of apiFiles) {
        // Support both relative to layer and full relative to project
        const fullPath = apiFile.startsWith(layerPath)
          ? apiFile
          : `${layerPath}/${apiFile}`
        normalizedPaths.add(normalizePathForComparison(fullPath))
      }

      publicApiMap.set(layerName, normalizedPaths)
    }
  }

  // Check each edge
  for (const edge of graph.edges) {
    const sourceMapping = mapper.map(edge.source)
    const targetMapping = mapper.map(edge.target)

    // Skip if either file is unmapped
    if (!sourceMapping || !targetMapping) {
      continue
    }

    // Skip if same layer (internal imports are always allowed)
    if (sourceMapping.layer === targetMapping.layer) {
      continue
    }

    // Check if target layer has public API configured
    const publicApiFiles = publicApiMap.get(targetMapping.layer)
    if (!publicApiFiles) {
      continue
    }

    // Check if target file is in the public API
    const normalizedTarget = normalizePathForComparison(edge.target)
    if (!publicApiFiles.has(normalizedTarget)) {
      // Get layer config for suggestion
      const layerConfig = config.layers[targetMapping.layer] as LayerConfig
      const apiFiles = Array.isArray(layerConfig.publicApi)
        ? layerConfig.publicApi
        : [layerConfig.publicApi!]

      violations.push(
        createPublicApiViolation({
          sourceFile: edge.source,
          targetFile: edge.target,
          sourceLayer: sourceMapping.layer,
          targetLayer: targetMapping.layer,
          publicApiFiles: apiFiles,
          importSpecifier: edge.specifier,
          line: edge.line,
        })
      )
    }
  }

  return violations
}

/**
 * Normalize a path for comparison (remove extension, normalize slashes)
 */
function normalizePathForComparison(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '')
    .replace(/\/index$/, '') // Treat dir/index as dir
}

/**
 * Check for dependent budget violations
 *
 * When a layer has maxDependents configured, warn if too many other layers
 * import from it.
 */
export function checkDependentBudget(
  graph: DependencyGraph,
  config: LayerguardConfig,
  mapper: LayerMapper
): DependentBudgetViolation[] {
  const violations: DependentBudgetViolation[] = []

  // Build map of layer -> set of layers that import from it
  const dependentsMap = new Map<string, Set<string>>()

  for (const edge of graph.edges) {
    const sourceMapping = mapper.map(edge.source)
    const targetMapping = mapper.map(edge.target)

    // Skip if either file is unmapped or same layer
    if (!sourceMapping || !targetMapping || sourceMapping.layer === targetMapping.layer) {
      continue
    }

    // Record that sourceMapping.layer depends on targetMapping.layer
    const dependents = dependentsMap.get(targetMapping.layer) ?? new Set()
    dependents.add(sourceMapping.layer)
    dependentsMap.set(targetMapping.layer, dependents)
  }

  // Check each layer's maxDependents
  for (const [layerName, layerConfig] of Object.entries(config.layers)) {
    if (layerConfig.maxDependents !== undefined) {
      const dependents = dependentsMap.get(layerName) ?? new Set()
      const actualDependents = dependents.size

      if (actualDependents > layerConfig.maxDependents) {
        violations.push(
          createDependentBudgetViolation({
            targetLayer: layerName,
            maxDependents: layerConfig.maxDependents,
            actualDependents,
            dependentLayers: Array.from(dependents).sort(),
          })
        )
      }
    }
  }

  return violations
}

/**
 * Check for import count violations
 *
 * When maxImportsPerFile is configured, warn if a file has too many imports.
 */
export function checkImportCount(
  graph: DependencyGraph,
  maxImports: number
): ImportCountViolation[] {
  const violations: ImportCountViolation[] = []

  // Count imports per file
  const importCounts = new Map<string, number>()

  for (const edge of graph.edges) {
    const count = importCounts.get(edge.source) ?? 0
    importCounts.set(edge.source, count + 1)
  }

  // Check each file
  for (const [file, count] of importCounts) {
    if (count > maxImports) {
      violations.push(
        createImportCountViolation({
          sourceFile: file,
          maxImports,
          actualImports: count,
        })
      )
    }
  }

  return violations
}

/**
 * Check all advanced rules
 */
export function checkAdvancedRules(
  graph: DependencyGraph,
  config: LayerguardConfig,
  mapper: LayerMapper,
  options: AdvancedRulesOptions = {}
): Violation[] {
  const violations: Violation[] = []
  const { maxImportDepth, maxImportsPerFile } = options

  // Check import depth
  if (maxImportDepth !== undefined) {
    violations.push(...checkImportDepth(graph, maxImportDepth))
  }

  // Check public API
  violations.push(...checkPublicApi(graph, config, mapper))

  // Check dependent budget
  violations.push(...checkDependentBudget(graph, config, mapper))

  // Check import count
  if (maxImportsPerFile !== undefined) {
    violations.push(...checkImportCount(graph, maxImportsPerFile))
  }

  return violations
}
