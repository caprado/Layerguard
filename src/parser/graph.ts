/**
 * Dependency graph builder - creates a full dependency graph from source files
 */

import { scanDirectory, type ScanOptions } from './scanner.js'
import { extractImports, type ImportInfo, type ExtractOptions } from './extractor.js'
import {
  createResolverContext,
  resolveImport,
  toRelativePath,
} from './resolver.js'

/**
 * An edge in the dependency graph
 */
export interface DependencyEdge {
  /**
   * Source file (relative path from project root)
   */
  source: string

  /**
   * Target file (relative path from project root)
   */
  target: string

  /**
   * Original import specifier
   */
  specifier: string

  /**
   * Whether this is a type-only import
   */
  isTypeOnly: boolean

  /**
   * Import kind (static, dynamic, reexport, require)
   */
  kind: ImportInfo['kind']

  /**
   * Line number in source file
   */
  line: number
}

/**
 * Full dependency graph of a project
 */
export interface DependencyGraph {
  /**
   * Project root directory
   */
  projectRoot: string

  /**
   * All source files (relative paths)
   */
  files: Set<string>

  /**
   * Adjacency list: source file -> set of target files it imports
   */
  adjacencyList: Map<string, Set<string>>

  /**
   * Detailed edges with metadata
   */
  edges: DependencyEdge[]

  /**
   * Files that had parse errors
   */
  parseErrors: Map<string, string[]>

  /**
   * Imports that could not be resolved
   */
  unresolvedImports: Array<{
    source: string
    specifier: string
    error?: string
  }>

  /**
   * External imports (for reference, not included in graph)
   */
  externalImports: Set<string>
}

/**
 * Options for building the dependency graph
 */
export interface BuildGraphOptions {
  /**
   * Project root directory
   */
  projectRoot: string

  /**
   * Path to tsconfig.json (optional, will be auto-detected)
   */
  tsconfigPath?: string

  /**
   * Additional ignore patterns
   */
  ignore?: string[]

  /**
   * Whether to include type-only imports in the graph
   * @default false
   */
  includeTypeOnlyImports?: boolean

  /**
   * Whether to include test files
   * @default false
   */
  includeTests?: boolean
}

/**
 * Build a complete dependency graph for a project
 */
export function buildDependencyGraph(options: BuildGraphOptions): DependencyGraph {
  const {
    projectRoot,
    tsconfigPath,
    ignore = [],
    includeTypeOnlyImports = false,
    includeTests = false,
  } = options

  // Scan for source files
  const scanOptions: ScanOptions = {
    root: projectRoot,
    ignore,
    includeTests,
    includeDeclarations: false,
  }
  const scanResult = scanDirectory(scanOptions)

  // Create resolver context
  const resolverContext = createResolverContext(projectRoot, tsconfigPath)

  // Initialize graph
  const graph: DependencyGraph = {
    projectRoot,
    files: new Set(),
    adjacencyList: new Map(),
    edges: [],
    parseErrors: new Map(),
    unresolvedImports: [],
    externalImports: new Set(),
  }

  // Process each file
  for (const absolutePath of scanResult.files) {
    const relativePath = toRelativePath(absolutePath, projectRoot)
    graph.files.add(relativePath)

    // Ensure file has an entry in adjacency list
    if (!graph.adjacencyList.has(relativePath)) {
      graph.adjacencyList.set(relativePath, new Set())
    }

    // Extract imports
    const extractOptions: ExtractOptions = {
      includeTypeOnly: true, // Extract all, filter later
      includeDynamic: true,
      includeRequire: false,
      includeReexports: true,
    }
    const extraction = extractImports(absolutePath, extractOptions)

    // Record parse errors
    if (extraction.errors.length > 0) {
      graph.parseErrors.set(relativePath, extraction.errors)
    }

    // Process each import
    for (const importInfo of extraction.imports) {
      // Skip type-only if not included
      if (importInfo.isTypeOnly && !includeTypeOnlyImports) {
        continue
      }

      // Resolve the import
      const resolved = resolveImport(importInfo.specifier, absolutePath, resolverContext)

      if (resolved.isExternal) {
        graph.externalImports.add(importInfo.specifier)
        continue
      }

      if (resolved.isUnresolved || !resolved.resolvedPath) {
        const unresolvedEntry: (typeof graph.unresolvedImports)[number] = {
          source: relativePath,
          specifier: importInfo.specifier,
        }
        if (resolved.error) {
          unresolvedEntry.error = resolved.error
        }
        graph.unresolvedImports.push(unresolvedEntry)
        continue
      }

      // Convert resolved path to relative
      const targetRelative = toRelativePath(resolved.resolvedPath, projectRoot)

      // Add to adjacency list
      const edges = graph.adjacencyList.get(relativePath)
      if (edges) {
        edges.add(targetRelative)
      }

      // Add detailed edge
      graph.edges.push({
        source: relativePath,
        target: targetRelative,
        specifier: importInfo.specifier,
        isTypeOnly: importInfo.isTypeOnly,
        kind: importInfo.kind,
        line: importInfo.line,
      })
    }
  }

  return graph
}

/**
 * Get all files that a given file depends on (direct dependencies)
 */
export function getDependencies(graph: DependencyGraph, file: string): string[] {
  const deps = graph.adjacencyList.get(file)
  return deps ? Array.from(deps) : []
}

/**
 * Get all files that depend on a given file (reverse dependencies)
 */
export function getDependents(graph: DependencyGraph, file: string): string[] {
  const dependents: string[] = []

  for (const [source, targets] of graph.adjacencyList) {
    if (targets.has(file)) {
      dependents.push(source)
    }
  }

  return dependents
}

/**
 * Get all edges between two files
 */
export function getEdgesBetween(
  graph: DependencyGraph,
  source: string,
  target: string
): DependencyEdge[] {
  return graph.edges.filter((edge) => edge.source === source && edge.target === target)
}

/**
 * Check if there's a direct dependency from source to target
 */
export function hasDependency(graph: DependencyGraph, source: string, target: string): boolean {
  const deps = graph.adjacencyList.get(source)
  return deps?.has(target) ?? false
}

/**
 * Get graph statistics
 */
export function getGraphStats(graph: DependencyGraph): {
  fileCount: number
  edgeCount: number
  parseErrorCount: number
  unresolvedCount: number
  externalPackageCount: number
} {
  return {
    fileCount: graph.files.size,
    edgeCount: graph.edges.length,
    parseErrorCount: graph.parseErrors.size,
    unresolvedCount: graph.unresolvedImports.length,
    externalPackageCount: graph.externalImports.size,
  }
}
