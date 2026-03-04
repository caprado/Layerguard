/**
 * Configuration cache for ESLint plugin
 *
 * ESLint processes files individually, so we cache the layerguard config
 * to avoid reloading it for every file.
 */

import { dirname } from 'node:path'
import { statSync } from 'node:fs'
import { loadConfigSync } from '../config/loader.js'
import { validateConfig } from '../config/validator.js'
import type { CachedConfig } from './types.js'

/**
 * Cache of loaded configurations by project root
 */
const configCache = new Map<string, CachedConfig>()

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000

/**
 * Get or load the layerguard configuration for a file
 *
 * @param filePath - The file being linted
 * @returns The cached configuration or null if not found/invalid
 */
export function getConfig(filePath: string): CachedConfig | null {
  const projectRoot = findProjectRoot(filePath)
  if (!projectRoot) {
    return null
  }

  // Check cache
  const cached = configCache.get(projectRoot)
  if (cached) {
    // Check if cache is still valid
    const now = Date.now()
    if (now - cached.loadedAt < CACHE_TTL) {
      // Check if config file has been modified
      try {
        const stat = statSync(cached.configPath)
        if (stat.mtimeMs <= cached.loadedAt) {
          return cached
        }
      } catch {
        // Config file might have been deleted
        configCache.delete(projectRoot)
        return null
      }
    }
  }

  // Load config
  try {
    const result = loadConfigSync(projectRoot)
    if (!result) {
      return null
    }

    const { config, configPath } = result

    // Validate config
    const validation = validateConfig(config, projectRoot)
    if (!validation.valid) {
      return null
    }

    const cachedConfig: CachedConfig = {
      config,
      configPath,
      projectRoot,
      loadedAt: Date.now(),
    }

    configCache.set(projectRoot, cachedConfig)
    return cachedConfig
  } catch {
    return null
  }
}

/**
 * Find the project root for a file
 *
 * Looks for package.json or layerguard config file
 */
function findProjectRoot(filePath: string): string | null {
  let dir = dirname(filePath)
  // Simple root detection - stop when we can't go up further
  // This works for both Unix (/) and Windows (C:\) style paths
  const isRoot = (path: string): boolean => {
    // Unix root
    if (path === '/') return true
    // Windows drive root (e.g., C:\)
    if (/^[A-Za-z]:\\$/.test(path)) return true
    // Relative path root
    if (path === '.' || path === '..') return true
    return false
  }

  // console.log('findProjectRoot starting with:', filePath, 'dir:', dir)

  while (!isRoot(dir)) {
    // console.log('Checking directory:', dir)
    // Check for layerguard config
    try {
      const result = loadConfigSync(dir)
      // console.log('loadConfigSync result for', dir, ':', result)
      if (result) {
        // console.log('Found config at:', dir)
        return dir
      }
    } catch (error) {
      // console.log('loadConfigSync error for', dir, ':', error)
      // No config in this directory
    }

    const parent = dirname(dir)
    // console.log('parent:', parent, 'dir:', dir)
    if (parent === dir) {
      break
    }
    dir = parent
  }

  // console.log('No project root found')
  return null
}

/**
 * Clear the configuration cache
 *
 * Useful for testing or when config changes are expected
 */
export function clearConfigCache(): void {
  configCache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: configCache.size,
    entries: Array.from(configCache.keys()),
  }
}
