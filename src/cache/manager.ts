/**
 * Cache manager for incremental checking
 *
 * Handles reading, writing, and validating the dependency graph cache.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import type { DependencyGraph } from '../parser/graph.js'
import type { ArchgateConfig } from '../config/types.js'
import {
  CACHE_VERSION,
  CACHE_DIR,
  CACHE_FILE,
  type CacheData,
  type CachedFile,
  type CacheValidation,
} from './types.js'

/**
 * Get the cache file path for a project
 */
export function getCachePath(projectRoot: string): string {
  return join(projectRoot, CACHE_DIR, CACHE_FILE)
}

/**
 * Get file modification time in milliseconds
 */
export function getFileMtime(filePath: string): number | null {
  try {
    const stats = statSync(filePath)
    return stats.mtimeMs
  } catch {
    return null
  }
}

/**
 * Create a hash of the config for cache invalidation
 */
export function hashConfig(config: ArchgateConfig): string {
  const configStr = JSON.stringify(config)
  return createHash('md5').update(configStr).digest('hex')
}

/**
 * Load cache from disk
 */
export function loadCache(projectRoot: string): CacheData | null {
  const cachePath = getCachePath(projectRoot)

  if (!existsSync(cachePath)) {
    return null
  }

  try {
    const content = readFileSync(cachePath, 'utf-8')
    const cache = JSON.parse(content) as CacheData

    // Check version compatibility
    if (cache.version !== CACHE_VERSION) {
      return null
    }

    return cache
  } catch {
    // Invalid cache file
    return null
  }
}

/**
 * Save cache to disk
 */
export function saveCache(projectRoot: string, cache: CacheData): void {
  const cachePath = getCachePath(projectRoot)
  const cacheDir = dirname(cachePath)

  // Ensure cache directory exists
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true })
  }

  const content = JSON.stringify(cache, null, 2)
  writeFileSync(cachePath, content, 'utf-8')
}

/**
 * Delete the cache file
 */
export function clearCache(projectRoot: string): boolean {
  const cachePath = getCachePath(projectRoot)

  if (!existsSync(cachePath)) {
    return false
  }

  try {
    rmSync(cachePath)
    return true
  } catch {
    return false
  }
}

/**
 * Validate cache against current file system state
 */
export function validateCache(
  cache: CacheData,
  projectRoot: string,
  currentFiles: string[],
  config: ArchgateConfig,
  tsconfigPath?: string
): CacheValidation {
  // Check version
  if (cache.version !== CACHE_VERSION) {
    return { valid: false, reason: 'Cache version mismatch' }
  }

  // Check project root
  if (cache.projectRoot !== projectRoot) {
    return { valid: false, reason: 'Project root changed' }
  }

  // Check config hash
  const currentConfigHash = hashConfig(config)
  if (cache.configHash && cache.configHash !== currentConfigHash) {
    return { valid: false, reason: 'Config changed' }
  }

  // Check tsconfig mtime
  if (tsconfigPath) {
    const currentTsconfigMtime = getFileMtime(tsconfigPath)
    if (currentTsconfigMtime !== null && cache.tsconfigMtime !== currentTsconfigMtime) {
      return { valid: false, reason: 'tsconfig.json changed' }
    }
  }

  // Find changed, deleted, and new files
  const cachedFiles = new Set(Object.keys(cache.files))
  const currentFileSet = new Set(currentFiles)

  const changedFiles: string[] = []
  const deletedFiles: string[] = []
  const newFiles: string[] = []

  // Check for changed and deleted files
  for (const file of cachedFiles) {
    if (!currentFileSet.has(file)) {
      deletedFiles.push(file)
    } else {
      const absolutePath = join(projectRoot, file)
      const currentMtime = getFileMtime(absolutePath)
      const cachedMtime = cache.files[file]?.mtime

      if (currentMtime !== null && cachedMtime !== currentMtime) {
        changedFiles.push(file)
      }
    }
  }

  // Check for new files
  for (const file of currentFiles) {
    if (!cachedFiles.has(file)) {
      newFiles.push(file)
    }
  }

  const hasChanges = changedFiles.length > 0 || deletedFiles.length > 0 || newFiles.length > 0

  if (hasChanges) {
    return {
      valid: true,
      changedFiles,
      deletedFiles,
      newFiles,
    }
  }

  return { valid: true }
}

/**
 * Convert a DependencyGraph to CacheData
 */
export function graphToCache(
  graph: DependencyGraph,
  config: ArchgateConfig,
  tsconfigPath?: string
): CacheData {
  const files: Record<string, CachedFile> = {}

  // Get mtime for each file
  for (const file of graph.files) {
    const absolutePath = join(graph.projectRoot, file)
    const mtime = getFileMtime(absolutePath) ?? Date.now()

    // Get edges for this file
    const edges = graph.edges.filter((e) => e.source === file)

    // Get parse errors for this file
    const parseErrors = graph.parseErrors.get(file)

    const cachedFile: CachedFile = { mtime, edges }
    if (parseErrors && parseErrors.length > 0) {
      cachedFile.parseErrors = parseErrors
    }
    files[file] = cachedFile
  }

  // Get tsconfig mtime
  const tsconfigMtime = tsconfigPath ? getFileMtime(tsconfigPath) : null

  const cacheData: CacheData = {
    version: CACHE_VERSION,
    timestamp: Date.now(),
    projectRoot: graph.projectRoot,
    configHash: hashConfig(config),
    files,
    externalImports: Array.from(graph.externalImports),
    unresolvedImports: [...graph.unresolvedImports],
  }

  if (tsconfigMtime !== null) {
    cacheData.tsconfigMtime = tsconfigMtime
  }

  return cacheData
}

/**
 * Convert CacheData to a DependencyGraph
 */
export function cacheToGraph(cache: CacheData): DependencyGraph {
  const files = new Set<string>(Object.keys(cache.files))
  const edges = Object.values(cache.files).flatMap((f) => f.edges)

  // Build adjacency list
  const adjacencyList = new Map<string, Set<string>>()
  for (const file of files) {
    adjacencyList.set(file, new Set())
  }
  for (const edge of edges) {
    const targets = adjacencyList.get(edge.source)
    if (targets) {
      targets.add(edge.target)
    }
  }

  // Build parse errors map
  const parseErrors = new Map<string, string[]>()
  for (const [file, data] of Object.entries(cache.files)) {
    if (data.parseErrors && data.parseErrors.length > 0) {
      parseErrors.set(file, data.parseErrors)
    }
  }

  return {
    projectRoot: cache.projectRoot,
    files,
    adjacencyList,
    edges,
    parseErrors,
    unresolvedImports: [...cache.unresolvedImports],
    externalImports: new Set(cache.externalImports),
  }
}

/**
 * Update cache with changes from specific files
 */
export function updateCacheFiles(
  cache: CacheData,
  updatedFiles: Map<string, CachedFile>,
  deletedFiles: string[]
): CacheData {
  const newFiles = { ...cache.files }

  // Remove deleted files
  for (const file of deletedFiles) {
    delete newFiles[file]
  }

  // Update/add changed files
  for (const [file, data] of updatedFiles) {
    newFiles[file] = data
  }

  // Rebuild unresolved imports (filter out deleted sources)
  const deletedSet = new Set(deletedFiles)
  const unresolvedImports = cache.unresolvedImports.filter(
    (u) => !deletedSet.has(u.source) && !updatedFiles.has(u.source)
  )

  return {
    ...cache,
    timestamp: Date.now(),
    files: newFiles,
    unresolvedImports,
  }
}
