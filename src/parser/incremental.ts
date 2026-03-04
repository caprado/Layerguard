/**
 * Incremental dependency graph builder
 *
 * Uses caching to only re-parse files that have changed since the last run.
 */

import { join } from 'node:path'
import { scanDirectory, type ScanOptions } from './scanner.js'
import { extractImports, type ExtractOptions } from './extractor.js'
import { createResolverContext, resolveImport, toRelativePath } from './resolver.js'
import type { DependencyGraph, DependencyEdge, BuildGraphOptions } from './graph.js'
import type { LayerguardConfig } from '../config/types.js'
import {
  loadCache,
  saveCache,
  validateCache,
  graphToCache,
  cacheToGraph,
  updateCacheFiles,
  getFileMtime,
  type CacheData,
  type CachedFile,
} from '../cache/index.js'

/**
 * Options for incremental graph building
 */
export interface IncrementalBuildOptions extends BuildGraphOptions {
  /**
   * Layerguard config (needed for cache invalidation)
   */
  config: LayerguardConfig

  /**
   * Whether to use caching
   * @default true
   */
  useCache?: boolean

  /**
   * Callback for progress reporting
   */
  onProgress?: (event: IncrementalProgressEvent) => void
}

/**
 * Progress events during incremental build
 */
export type IncrementalProgressEvent =
  | { type: 'cache-hit'; changedFiles: number; totalFiles: number }
  | { type: 'cache-miss'; reason: string }
  | { type: 'parsing'; file: string; current: number; total: number }
  | { type: 'complete'; fromCache: boolean; filesProcessed: number }

/**
 * Result of incremental build
 */
export interface IncrementalBuildResult {
  /**
   * The dependency graph
   */
  graph: DependencyGraph

  /**
   * Whether the cache was used
   */
  cacheHit: boolean

  /**
   * Number of files that were (re)parsed
   */
  filesParsed: number

  /**
   * Total number of files in the project
   */
  totalFiles: number

  /**
   * Build duration in milliseconds
   */
  duration: number
}

/**
 * Build dependency graph incrementally using cache
 */
export function buildDependencyGraphIncremental(
  options: IncrementalBuildOptions
): IncrementalBuildResult {
  const startTime = Date.now()
  const {
    projectRoot,
    config,
    tsconfigPath,
    ignore = [],
    includeTypeOnlyImports = false,
    includeTests = false,
    useCache = true,
    onProgress,
  } = options

  // Scan for current source files
  const scanOptions: ScanOptions = {
    root: projectRoot,
    ignore,
    includeTests,
    includeDeclarations: false,
  }
  const scanResult = scanDirectory(scanOptions)
  const currentFiles = scanResult.files.map((f) => toRelativePath(f, projectRoot))

  // Try to load and use cache
  if (useCache) {
    const cache = loadCache(projectRoot)

    if (cache) {
      const validation = validateCache(cache, projectRoot, currentFiles, config, tsconfigPath)

      if (validation.valid) {
        const changedFiles = validation.changedFiles ?? []
        const deletedFiles = validation.deletedFiles ?? []
        const newFiles = validation.newFiles ?? []
        const filesToProcess = [...changedFiles, ...newFiles]

        // If no changes, return cached graph directly
        if (filesToProcess.length === 0 && deletedFiles.length === 0) {
          onProgress?.({ type: 'cache-hit', changedFiles: 0, totalFiles: currentFiles.length })
          onProgress?.({ type: 'complete', fromCache: true, filesProcessed: 0 })

          return {
            graph: cacheToGraph(cache),
            cacheHit: true,
            filesParsed: 0,
            totalFiles: currentFiles.length,
            duration: Date.now() - startTime,
          }
        }

        // Incremental update: only process changed/new files
        onProgress?.({
          type: 'cache-hit',
          changedFiles: filesToProcess.length,
          totalFiles: currentFiles.length,
        })

        const result = processFilesIncremental(
          filesToProcess,
          projectRoot,
          tsconfigPath,
          includeTypeOnlyImports,
          onProgress
        )

        // Save updated cache
        const updatedCache = updateCacheFiles(cache, result.updatedFiles, deletedFiles)

        // Add new unresolved imports
        updatedCache.unresolvedImports = [
          ...updatedCache.unresolvedImports,
          ...result.unresolvedImports,
        ]

        // Update external imports
        updatedCache.externalImports = Array.from(
          new Set([...updatedCache.externalImports, ...result.externalImports])
        )

        try {
          saveCache(projectRoot, updatedCache)
        } catch {
          // Cache save errors should not break the build
        }

        onProgress?.({
          type: 'complete',
          fromCache: true,
          filesProcessed: filesToProcess.length,
        })

        return {
          graph: cacheToGraph(updatedCache),
          cacheHit: true,
          filesParsed: filesToProcess.length,
          totalFiles: currentFiles.length,
          duration: Date.now() - startTime,
        }
      } else {
        onProgress?.({ type: 'cache-miss', reason: validation.reason ?? 'unknown' })
      }
    } else {
      onProgress?.({ type: 'cache-miss', reason: 'no cache file' })
    }
  }

  // Full rebuild
  const graph = buildFullGraph(
    projectRoot,
    scanResult.files,
    tsconfigPath,
    includeTypeOnlyImports,
    onProgress
  )

  // Save cache for next run
  if (useCache) {
    const cache = graphToCache(graph, config, tsconfigPath)
    try {
      saveCache(projectRoot, cache)
    } catch {
      // Cache save errors should not break the build
    }
  }

  onProgress?.({
    type: 'complete',
    fromCache: false,
    filesProcessed: graph.files.size,
  })

  return {
    graph,
    cacheHit: false,
    filesParsed: graph.files.size,
    totalFiles: graph.files.size,
    duration: Date.now() - startTime,
  }
}

/**
 * Process only changed/new files incrementally
 */
function processFilesIncremental(
  filesToProcess: string[],
  projectRoot: string,
  tsconfigPath: string | undefined,
  includeTypeOnlyImports: boolean,
  onProgress?: (event: IncrementalProgressEvent) => void
): {
  updatedFiles: Map<string, CachedFile>
  unresolvedImports: CacheData['unresolvedImports']
  externalImports: string[]
} {
  const resolverContext = createResolverContext(projectRoot, tsconfigPath)
  const updatedFiles = new Map<string, CachedFile>()
  const unresolvedImports: CacheData['unresolvedImports'] = []
  const externalImports: string[] = []

  for (let i = 0; i < filesToProcess.length; i++) {
    const relativePath = filesToProcess[i]!
    const absolutePath = join(projectRoot, relativePath)

    onProgress?.({
      type: 'parsing',
      file: relativePath,
      current: i + 1,
      total: filesToProcess.length,
    })

    const mtime = getFileMtime(absolutePath) ?? Date.now()
    const edges: DependencyEdge[] = []

    // Extract imports
    const extractOptions: ExtractOptions = {
      includeTypeOnly: true,
      includeDynamic: true,
      includeRequire: true,
      includeReexports: true,
    }
    const extraction = extractImports(absolutePath, extractOptions)

    // Process each import
    for (const importInfo of extraction.imports) {
      if (importInfo.isTypeOnly && !includeTypeOnlyImports) {
        continue
      }

      const resolved = resolveImport(importInfo.specifier, absolutePath, resolverContext)

      if (resolved.isExternal) {
        externalImports.push(importInfo.specifier)
        continue
      }

      if (resolved.isUnresolved || !resolved.resolvedPath) {
        const unresolvedEntry: CacheData['unresolvedImports'][number] = {
          source: relativePath,
          specifier: importInfo.specifier,
        }
        if (resolved.error) {
          unresolvedEntry.error = resolved.error
        }
        unresolvedImports.push(unresolvedEntry)
        continue
      }

      const targetRelative = toRelativePath(resolved.resolvedPath, projectRoot)

      edges.push({
        source: relativePath,
        target: targetRelative,
        specifier: importInfo.specifier,
        isTypeOnly: importInfo.isTypeOnly,
        kind: importInfo.kind,
        line: importInfo.line,
      })
    }

    const cachedFile: CachedFile = { mtime, edges }
    if (extraction.errors.length > 0) {
      cachedFile.parseErrors = extraction.errors
    }
    updatedFiles.set(relativePath, cachedFile)
  }

  return { updatedFiles, unresolvedImports, externalImports }
}

/**
 * Build full dependency graph (no caching)
 */
function buildFullGraph(
  projectRoot: string,
  absolutePaths: string[],
  tsconfigPath: string | undefined,
  includeTypeOnlyImports: boolean,
  onProgress?: (event: IncrementalProgressEvent) => void
): DependencyGraph {
  const resolverContext = createResolverContext(projectRoot, tsconfigPath)

  const graph: DependencyGraph = {
    projectRoot,
    files: new Set(),
    adjacencyList: new Map(),
    edges: [],
    parseErrors: new Map(),
    unresolvedImports: [],
    externalImports: new Set(),
  }

  for (let i = 0; i < absolutePaths.length; i++) {
    const absolutePath = absolutePaths[i]!
    const relativePath = toRelativePath(absolutePath, projectRoot)

    onProgress?.({
      type: 'parsing',
      file: relativePath,
      current: i + 1,
      total: absolutePaths.length,
    })

    graph.files.add(relativePath)

    if (!graph.adjacencyList.has(relativePath)) {
      graph.adjacencyList.set(relativePath, new Set())
    }

    const extractOptions: ExtractOptions = {
      includeTypeOnly: true,
      includeDynamic: true,
      includeRequire: true,
      includeReexports: true,
    }
    const extraction = extractImports(absolutePath, extractOptions)

    if (extraction.errors.length > 0) {
      graph.parseErrors.set(relativePath, extraction.errors)
    }

    for (const importInfo of extraction.imports) {
      if (importInfo.isTypeOnly && !includeTypeOnlyImports) {
        continue
      }

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

      const targetRelative = toRelativePath(resolved.resolvedPath, projectRoot)

      const edges = graph.adjacencyList.get(relativePath)
      if (edges) {
        edges.add(targetRelative)
      }

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
