/**
 * Cache types for incremental checking
 */

import type { DependencyEdge } from '../parser/graph.js'

/**
 * Cache format version - bump when cache structure changes
 */
export const CACHE_VERSION = '1.0.0'

/**
 * Default cache directory name
 */
export const CACHE_DIR = '.layerguard-cache'

/**
 * Cache file name
 */
export const CACHE_FILE = 'graph.json'

/**
 * Cached data for a single file
 */
export interface CachedFile {
  /**
   * File modification time (ms since epoch)
   */
  mtime: number

  /**
   * Edges originating from this file
   */
  edges: DependencyEdge[]

  /**
   * Parse errors for this file
   */
  parseErrors?: string[]
}

/**
 * Full cache data structure
 */
export interface CacheData {
  /**
   * Cache format version
   */
  version: string

  /**
   * When the cache was last updated (ms since epoch)
   */
  timestamp: number

  /**
   * Project root path
   */
  projectRoot: string

  /**
   * Modification time of tsconfig.json (if present)
   */
  tsconfigMtime?: number

  /**
   * Hash of the layerguard config (to invalidate on config changes)
   */
  configHash?: string

  /**
   * Per-file cached data
   */
  files: Record<string, CachedFile>

  /**
   * External package imports (npm packages, node: imports)
   */
  externalImports: string[]

  /**
   * Unresolved imports
   */
  unresolvedImports: Array<{
    source: string
    specifier: string
    error?: string
  }>
}

/**
 * Result of checking cache validity
 */
export interface CacheValidation {
  /**
   * Whether the cache is valid and can be used
   */
  valid: boolean

  /**
   * Reason for invalidity, if applicable
   */
  reason?: string

  /**
   * Files that have changed since the cache was created
   */
  changedFiles?: string[]

  /**
   * Files that were deleted since the cache was created
   */
  deletedFiles?: string[]

  /**
   * New files that aren't in the cache
   */
  newFiles?: string[]
}
