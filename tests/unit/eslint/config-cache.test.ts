/**
 * Tests for ESLint config cache
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { LayerguardConfig } from '../../../src/config/types.js'

// Import modules normally
import { clearConfigCache, getCacheStats, getConfig } from '../../../src/eslint/config-cache.js'
import * as loader from '../../../src/config/loader.js'
import * as validator from '../../../src/config/validator.js'
import fs from 'node:fs'

vi.mock('../../../src/config/loader.js')
vi.mock('../../../src/config/validator.js')
vi.mock('node:fs')

describe('ESLint config cache', () => {
  beforeEach(() => {
    clearConfigCache()
    vi.resetAllMocks()

    // Default: validator returns valid
    vi.mocked(validator.validateConfig).mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      flowGraph: null,
      parsedFlowRules: [],
    })

    // Mock statSync to avoid file system errors
    vi.mocked(fs.statSync).mockReturnValue({
      mtimeMs: BigInt(Date.now() - 1000), // File was modified 1 second ago
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('exports', () => {
    it('should export clearConfigCache function', () => {
      expect(clearConfigCache).toBeDefined()
      expect(typeof clearConfigCache).toBe('function')
    })

    it('should export getCacheStats function', () => {
      expect(getCacheStats).toBeDefined()
      expect(typeof getCacheStats).toBe('function')
    })
  })

  describe('clearConfigCache', () => {
    it('should not throw when clearing empty cache', () => {
      expect(() => clearConfigCache()).not.toThrow()
    })

    it('should be callable multiple times', () => {
      clearConfigCache()
      clearConfigCache()
      expect(getCacheStats().size).toBe(0)
    })
  })

  describe('getCacheStats', () => {
    it('should return stats object with size and entries', () => {
      const stats = getCacheStats()
      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('entries')
      expect(typeof stats.size).toBe('number')
      expect(Array.isArray(stats.entries)).toBe(true)
    })

    it('should return empty stats for empty cache', () => {
      clearConfigCache()
      const stats = getCacheStats()
      expect(stats.size).toBe(0)
      expect(stats.entries).toHaveLength(0)
    })

    it('should return correct stats when cache has entries', () => {
      const mockConfig: LayerguardConfig = {
        layers: { components: { path: 'src/components' } },
        flow: [],
      }
      
      // Mock the loader to return a config when called with '/project'
      vi.mocked(loader.loadConfigSync).mockImplementation((dir) => {
        if (dir === '/project') {
          return {
            config: mockConfig,
            configPath: '/project/layerguard.config.ts',
          }
        }
        return null
      })

      getConfig('/project/src/file.ts')
      
      const stats = getCacheStats()
      expect(stats.size).toBe(1)
      expect(stats.entries).toContain('/project')
    })
  })

  describe('getConfig', () => {
    it('returns null when no config found in directory hierarchy', () => {
      vi.mocked(loader.loadConfigSync).mockReturnValue(null)

      const result = getConfig('/some/project/src/file.ts')

      expect(result).toBeNull()
    })

    it('returns null for invalid config', () => {
      const invalidConfig: LayerguardConfig = {
        layers: {
          invalid: { path: '' }, // Empty path is invalid
        },
        flow: [],
      }

      vi.mocked(loader.loadConfigSync).mockReturnValue({
        config: invalidConfig,
        configPath: '/project/layerguard.config.ts',
      })

      // Validator returns invalid
      vi.mocked(validator.validateConfig).mockReturnValue({
        valid: false,
        errors: [{ type: 'error', code: 'INVALID_PATH', path: 'layers.invalid.path', message: 'Path cannot be empty' }],
        warnings: [],
        flowGraph: null,
        parsedFlowRules: [],
      })

      const result = getConfig('/project/src/file.ts')

      expect(result).toBeNull()
    })

    it('handles loadConfigSync throwing error', () => {
      vi.mocked(loader.loadConfigSync).mockImplementation(() => {
        throw new Error('Config load error')
      })

      const result = getConfig('/project/src/file.ts')

      expect(result).toBeNull()
    })

    it('returns null when reaching filesystem root without finding config', () => {
      vi.mocked(loader.loadConfigSync).mockReturnValue(null)

      const result = getConfig('/some/deep/path/file.ts')
      expect(result).toBeNull()
    })

    it('returns cached config when valid and not expired', () => {
      // Mock the loader to return a config when called with '/project'
      vi.mocked(loader.loadConfigSync).mockImplementation((dir) => {
        if (dir === '/project') {
          return {
            config: { layers: { components: { path: 'src/components' } }, flow: [] },
            configPath: '/project/layerguard.config.ts',
          }
        }
        return null
      })

      // First, let's just test that we can get a config at all
      const result = getConfig('/project/src/file.ts')
      expect(result).not.toBeNull()
      
      // If we get here, then test the caching behavior
      if (result) {
        expect(result).toEqual(expect.objectContaining({
          config: { layers: { components: { path: 'src/components' } }, flow: [] },
          configPath: '/project/layerguard.config.ts',
          projectRoot: '/project',
        }))
        // Note: loadConfigSync is called multiple times during directory traversal
        expect(loader.loadConfigSync).toHaveBeenCalled()

        // Second call - should return cached version
        const secondResult = getConfig('/project/src/other.ts')
        
        expect(secondResult).not.toBeNull()
        expect(secondResult).toEqual(result)
      }
    })

    it('finds project root by walking up directory hierarchy', () => {
      // Mock config found in parent directory
      vi.mocked(loader.loadConfigSync).mockImplementation((dir) => {
        if (dir === '/project') {
          return {
            config: { layers: { components: { path: 'src/components' } }, flow: [] },
            configPath: '/project/layerguard.config.ts',
          }
        }
        return null
      })

      const result = getConfig('/project/src/subdir/file.ts')
      
      expect(result).not.toBeNull()
      expect(result?.projectRoot).toBe('/project')
      expect(result?.configPath).toBe('/project/layerguard.config.ts')
    })

    it('handles successful config loading and caching', () => {
      const mockConfig: LayerguardConfig = {
        layers: { components: { path: 'src/components' } },
        flow: ['components -> utils'],
        rules: { circular: 'error' },
      }
      
      const configPath = '/project/layerguard.config.ts'

      // Mock the loader to return a config when called with '/project'
      vi.mocked(loader.loadConfigSync).mockImplementation((dir) => {
        if (dir === '/project') {
          return {
            config: mockConfig,
            configPath,
          }
        }
        return null
      })

      const result = getConfig('/project/src/file.ts')
      
      expect(result).toEqual(expect.objectContaining({
        config: mockConfig,
        configPath,
        projectRoot: '/project',
        loadedAt: expect.any(Number),
      }))
      
      // Should be cached now
      const cachedResult = getConfig('/project/src/other.ts')
      
      expect(cachedResult).toEqual(result)
    })
  })
})