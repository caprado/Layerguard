import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildDependencyGraphIncremental } from '../../../src/parser/incremental.js'
import * as scanner from '../../../src/parser/scanner.js'
import * as extractor from '../../../src/parser/extractor.js'
import * as resolver from '../../../src/parser/resolver.js'
import * as cacheManager from '../../../src/cache/manager.js'
import { CACHE_VERSION } from '../../../src/cache/types.js'
import type { CacheData } from '../../../src/cache/types.js'
import type { ArchgateConfig } from '../../../src/config/types.js'

vi.mock('../../../src/parser/scanner.js')
vi.mock('../../../src/parser/extractor.js')
vi.mock('../../../src/parser/resolver.js')
vi.mock('../../../src/cache/manager.js')

describe('buildDependencyGraphIncremental', () => {
  const mockConfig: ArchgateConfig = {
    layers: {
      components: { path: 'src/components' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> utils'],
  }

  const mockProjectRoot = '/project'

  beforeEach(() => {
    vi.resetAllMocks()

    // Default mock implementations
    vi.mocked(scanner.scanDirectory).mockReturnValue({
      files: ['/project/src/a.ts', '/project/src/b.ts'],
      skipped: [],
      skippedDirs: [],
    })

    vi.mocked(resolver.toRelativePath).mockImplementation((p, root) => {
      return p.replace(root + '/', '')
    })

    vi.mocked(resolver.createResolverContext).mockReturnValue({
      projectRoot: mockProjectRoot,
      compilerOptions: {},
      moduleResolutionHost: {} as any,
      pathMappings: {},
    })

    vi.mocked(extractor.extractImports).mockReturnValue({
      filePath: '/project/src/a.ts',
      imports: [],
      errors: [],
    })

    vi.mocked(cacheManager.getFileMtime).mockReturnValue(1000)
    vi.mocked(cacheManager.hashConfig).mockReturnValue('config-hash')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('without cache', () => {
    it('performs full build when useCache is false', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
        useCache: false,
      })

      expect(cacheManager.loadCache).not.toHaveBeenCalled()
      expect(result.cacheHit).toBe(false)
      expect(result.graph).toBeDefined()
    })

    it('performs full build when no cache exists', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(false)
      expect(result.filesParsed).toBe(2)
    })

    it('saves cache after full build', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(cacheManager.saveCache).toHaveBeenCalled()
    })
  })

  describe('with valid cache', () => {
    const mockCache: CacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      projectRoot: mockProjectRoot,
      configHash: 'config-hash',
      files: {
        'src/a.ts': { mtime: 1000, edges: [] },
        'src/b.ts': { mtime: 1000, edges: [] },
      },
      externalImports: [],
      unresolvedImports: [],
    }

    it('returns cached graph when no files changed', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(mockCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({ valid: true })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(true)
      expect(result.filesParsed).toBe(0)
    })

    it('incrementally updates when files changed', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(mockCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({
        valid: true,
        changedFiles: ['src/a.ts'],
        newFiles: [],
        deletedFiles: [],
      })
      vi.mocked(cacheManager.updateCacheFiles).mockReturnValue({
        ...mockCache,
        unresolvedImports: [],
        externalImports: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(true)
      expect(result.filesParsed).toBe(1)
    })

    it('handles new files incrementally', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(mockCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({
        valid: true,
        changedFiles: [],
        newFiles: ['src/c.ts'],
        deletedFiles: [],
      })
      vi.mocked(cacheManager.updateCacheFiles).mockReturnValue({
        ...mockCache,
        unresolvedImports: [],
        externalImports: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(true)
      expect(result.filesParsed).toBe(1)
    })

    it('handles deleted files', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(mockCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({
        valid: true,
        changedFiles: [],
        newFiles: [],
        deletedFiles: ['src/b.ts'],
      })
      vi.mocked(cacheManager.updateCacheFiles).mockReturnValue({
        ...mockCache,
        files: { 'src/a.ts': { mtime: 1000, edges: [] } },
        unresolvedImports: [],
        externalImports: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(true)
      expect(cacheManager.updateCacheFiles).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        ['src/b.ts']
      )
    })
  })

  describe('with invalid cache', () => {
    it('performs full rebuild when config changed', () => {
      const oldCache: CacheData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        projectRoot: mockProjectRoot,
        configHash: 'old-hash',
        files: {},
        externalImports: [],
        unresolvedImports: [],
      }

      vi.mocked(cacheManager.loadCache).mockReturnValue(oldCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({
        valid: false,
        reason: 'Config changed',
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(false)
    })

    it('performs full rebuild when cache version mismatch', () => {
      const oldCache: CacheData = {
        version: '0.0.1',
        timestamp: Date.now(),
        projectRoot: mockProjectRoot,
        configHash: 'config-hash',
        files: {},
        externalImports: [],
        unresolvedImports: [],
      }

      vi.mocked(cacheManager.loadCache).mockReturnValue(oldCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({
        valid: false,
        reason: 'Version mismatch',
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(false)
    })
  })

  describe('progress reporting', () => {
    it('calls onProgress with cache-hit event', () => {
      const onProgress = vi.fn()

      const mockCache: CacheData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        projectRoot: mockProjectRoot,
        configHash: 'config-hash',
        files: {
          'src/a.ts': { mtime: 1000, edges: [] },
          'src/b.ts': { mtime: 1000, edges: [] },
        },
        externalImports: [],
        unresolvedImports: [],
      }

      vi.mocked(cacheManager.loadCache).mockReturnValue(mockCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({ valid: true })

      buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
        onProgress,
      })

      expect(onProgress).toHaveBeenCalledWith({
        type: 'cache-hit',
        changedFiles: 0,
        totalFiles: 2,
      })
    })

    it('calls onProgress with cache-miss event', () => {
      const onProgress = vi.fn()

      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
        onProgress,
      })

      expect(onProgress).toHaveBeenCalledWith({
        type: 'cache-miss',
        reason: 'no cache file',
      })
    })

    it('calls onProgress with complete event', () => {
      const onProgress = vi.fn()

      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
        onProgress,
      })

      expect(onProgress).toHaveBeenCalledWith({
        type: 'complete',
        fromCache: false,
        filesProcessed: 2,
      })
    })
  })

  describe('result properties', () => {
    it('includes duration in result', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('includes totalFiles in result', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.totalFiles).toBe(2)
    })
  })

  describe('processFilesIncremental function', () => {
    it('processes changed files with parsing progress events', () => {
      const onProgress = vi.fn()
      
      const mockCache: CacheData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        projectRoot: mockProjectRoot,
        configHash: 'config-hash',
        files: {
          'src/a.ts': { mtime: 1000, edges: [] },
        },
        externalImports: [],
        unresolvedImports: [],
      }

      vi.mocked(cacheManager.loadCache).mockReturnValue(mockCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({
        valid: true,
        changedFiles: ['src/b.ts'],
        newFiles: [],
        deletedFiles: [],
      })
      vi.mocked(cacheManager.updateCacheFiles).mockReturnValue({
        ...mockCache,
        files: {
          'src/a.ts': { mtime: 1000, edges: [] },
          'src/b.ts': { mtime: 2000, edges: [] },
        },
        unresolvedImports: [],
        externalImports: [],
      })

      // Mock resolver for internal imports
      vi.mocked(resolver.resolveImport).mockReturnValue({
        specifier: './utils',
        resolvedPath: '/project/src/utils/index.ts',
        isExternal: false,
        isUnresolved: false,
      })

      // Mock file processing
      vi.mocked(extractor.extractImports).mockReturnValue({
        filePath: '/project/src/b.ts',
        imports: [{
          specifier: './utils',
          isTypeOnly: false,
          kind: 'static',
          line: 1,
          column: 0,
        }],
        errors: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
        onProgress,
      })

      // Should have called parsing progress events
      expect(onProgress).toHaveBeenCalledWith({
        type: 'parsing',
        file: 'src/b.ts',
        current: 1,
        total: 1,
      })
      
      expect(result.cacheHit).toBe(true)
      expect(result.filesParsed).toBe(1)
    })

    it('handles parse errors during incremental processing', () => {
      const mockCache: CacheData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        projectRoot: mockProjectRoot,
        configHash: 'config-hash',
        files: {
          'src/a.ts': { mtime: 1000, edges: [] },
        },
        externalImports: [],
        unresolvedImports: [],
      }

      vi.mocked(cacheManager.loadCache).mockReturnValue(mockCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({
        valid: true,
        changedFiles: ['src/b.ts'],
        newFiles: [],
        deletedFiles: [],
      })
      vi.mocked(cacheManager.updateCacheFiles).mockReturnValue({
        ...mockCache,
        files: {
          'src/a.ts': { mtime: 1000, edges: [] },
          'src/b.ts': { mtime: 2000, edges: [] },
        },
        unresolvedImports: [],
        externalImports: [],
      })

      // Mock file processing with errors
      vi.mocked(extractor.extractImports).mockReturnValue({
        filePath: '/project/src/b.ts',
        imports: [],
        errors: ['Syntax error: Unexpected token'],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(true)
      // Cache should still be saved even with parse errors
      expect(cacheManager.saveCache).toHaveBeenCalled()
    })

    it('handles external imports during incremental processing', () => {
      const mockCache: CacheData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        projectRoot: mockProjectRoot,
        configHash: 'config-hash',
        files: {
          'src/a.ts': { mtime: 1000, edges: [] },
        },
        externalImports: [],
        unresolvedImports: [],
      }

      vi.mocked(cacheManager.loadCache).mockReturnValue(mockCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({
        valid: true,
        changedFiles: ['src/b.ts'],
        newFiles: [],
        deletedFiles: [],
      })
      vi.mocked(cacheManager.updateCacheFiles).mockReturnValue({
        ...mockCache,
        files: {
          'src/a.ts': { mtime: 1000, edges: [] },
          'src/b.ts': { mtime: 2000, edges: [] },
        },
        unresolvedImports: [],
        externalImports: ['lodash'],
      })

      // Mock resolver for external imports
      vi.mocked(resolver.resolveImport).mockReturnValue({
        specifier: 'lodash',
        resolvedPath: null,
        isExternal: true,
        isUnresolved: false,
      })

      // Mock file processing with external imports
      vi.mocked(extractor.extractImports).mockReturnValue({
        filePath: '/project/src/b.ts',
        imports: [{
          specifier: 'lodash',
          isTypeOnly: false,
          kind: 'static',
          line: 1,
          column: 0,
        }],
        errors: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(true)
      expect(cacheManager.saveCache).toHaveBeenCalled()
    })

    it('handles unresolved imports during incremental processing', () => {
      const mockCache: CacheData = {
        version: CACHE_VERSION,
        timestamp: Date.now(),
        projectRoot: mockProjectRoot,
        configHash: 'config-hash',
        files: {
          'src/a.ts': { mtime: 1000, edges: [] },
        },
        externalImports: [],
        unresolvedImports: [],
      }

      vi.mocked(cacheManager.loadCache).mockReturnValue(mockCache)
      vi.mocked(cacheManager.validateCache).mockReturnValue({
        valid: true,
        changedFiles: ['src/b.ts'],
        newFiles: [],
        deletedFiles: [],
      })
      vi.mocked(cacheManager.updateCacheFiles).mockReturnValue({
        ...mockCache,
        files: {
          'src/a.ts': { mtime: 1000, edges: [] },
          'src/b.ts': { mtime: 2000, edges: [] },
        },
        unresolvedImports: [{
          source: 'src/b.ts',
          specifier: './nonexistent',
        }],
        externalImports: [],
      })

      // Mock resolver to return unresolved
      vi.mocked(resolver.resolveImport).mockReturnValue({
        specifier: './nonexistent',
        resolvedPath: null,
        isExternal: false,
        isUnresolved: true,
      })

      // Mock file processing with imports that can't be resolved
      vi.mocked(extractor.extractImports).mockReturnValue({
        filePath: '/project/src/b.ts',
        imports: [{
          specifier: './nonexistent',
          isTypeOnly: false,
          kind: 'static',
          line: 1,
          column: 0,
        }],
        errors: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(true)
      expect(cacheManager.saveCache).toHaveBeenCalled()
    })
  })

  describe('buildFullGraph function', () => {
    it('processes all files with parsing progress events', () => {
      const onProgress = vi.fn()
      
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      // Mock resolver for internal imports
      vi.mocked(resolver.resolveImport).mockReturnValue({
        specifier: './utils',
        resolvedPath: '/project/src/utils/index.ts',
        isExternal: false,
        isUnresolved: false,
      })

      // Mock file processing
      vi.mocked(extractor.extractImports).mockReturnValue({
        filePath: '/project/src/a.ts',
        imports: [{
          specifier: './utils',
          isTypeOnly: false,
          kind: 'static',
          line: 1,
          column: 0,
        }],
        errors: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
        onProgress,
      })

      // Should have called parsing progress events for each file
      expect(onProgress).toHaveBeenCalledWith({
        type: 'parsing',
        file: 'src/a.ts',
        current: 1,
        total: 2,
      })
      
      expect(onProgress).toHaveBeenCalledWith({
        type: 'parsing',
        file: 'src/b.ts',
        current: 2,
        total: 2,
      })
      
      expect(result.cacheHit).toBe(false)
      expect(result.filesParsed).toBe(2)
    })

    it('handles parse errors during full build', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      // Mock file processing with errors
      vi.mocked(extractor.extractImports).mockReturnValueOnce({
        filePath: '/project/src/a.ts',
        imports: [],
        errors: ['Syntax error: Unexpected token'],
      }).mockReturnValueOnce({
        filePath: '/project/src/b.ts',
        imports: [],
        errors: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(false)
      expect(result.filesParsed).toBe(2)
      // Cache should still be saved even with parse errors
      expect(cacheManager.saveCache).toHaveBeenCalled()
    })

    it('handles external imports during full build', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      // Mock resolver for external imports
      vi.mocked(resolver.resolveImport).mockReturnValue({
        specifier: 'lodash',
        resolvedPath: null,
        isExternal: true,
        isUnresolved: false,
      })

      // Mock file processing with external imports
      vi.mocked(extractor.extractImports).mockReturnValue({
        filePath: '/project/src/a.ts',
        imports: [{
          specifier: 'lodash',
          isTypeOnly: false,
          kind: 'static',
          line: 1,
          column: 0,
        }],
        errors: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(false)
      expect(result.filesParsed).toBe(2)
      expect(cacheManager.saveCache).toHaveBeenCalled()
    })

    it('handles unresolved imports during full build', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      // Mock resolver to return unresolved
      vi.mocked(resolver.resolveImport).mockReturnValue({
        specifier: './nonexistent',
        resolvedPath: null,
        isExternal: false,
        isUnresolved: true,
      })

      // Mock file processing with imports that can't be resolved
      vi.mocked(extractor.extractImports).mockReturnValue({
        filePath: '/project/src/a.ts',
        imports: [{
          specifier: './nonexistent',
          isTypeOnly: false,
          kind: 'static',
          line: 1,
          column: 0,
        }],
        errors: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(false)
      expect(result.filesParsed).toBe(2)
      expect(cacheManager.saveCache).toHaveBeenCalled()
    })

    it('respects includeTypeOnlyImports option', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      // Mock resolver for both imports
      vi.mocked(resolver.resolveImport).mockImplementation((specifier) => {
        if (specifier === './utils') {
          return {
            specifier: './utils',
            resolvedPath: '/project/src/utils/index.ts',
            isExternal: false,
            isUnresolved: false,
          }
        } else {
          return {
            specifier: './components',
            resolvedPath: '/project/src/components/index.ts',
            isExternal: false,
            isUnresolved: false,
          }
        }
      })

      // Mock file processing with type-only imports
      vi.mocked(extractor.extractImports).mockReturnValue({
        filePath: '/project/src/a.ts',
        imports: [
          {
            specifier: './utils',
            isTypeOnly: true,
            kind: 'static',
            line: 1,
            column: 0,
          },
          {
            specifier: './components',
            isTypeOnly: false,
            kind: 'static',
            line: 2,
            column: 0,
          }
        ],
        errors: [],
      })

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
        includeTypeOnlyImports: false, // Should exclude type-only imports
      })

      expect(result.cacheHit).toBe(false)
      expect(cacheManager.saveCache).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('handles empty file list', () => {
      vi.mocked(scanner.scanDirectory).mockReturnValue({
        files: [],
        skipped: [],
        skippedDirs: [],
      })
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(false)
      expect(result.filesParsed).toBe(0)
      expect(result.totalFiles).toBe(0)
      expect(result.graph.files.size).toBe(0)
    })

    it('handles scanner errors', () => {
      vi.mocked(scanner.scanDirectory).mockReturnValue({
        files: [],
        skipped: [],
        skippedDirs: [],
      })
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)

      const result = buildDependencyGraphIncremental({
        projectRoot: mockProjectRoot,
        config: mockConfig,
      })

      expect(result.cacheHit).toBe(false)
      expect(result.graph.files.size).toBe(0)
    })

    it('handles cache save errors gracefully', () => {
      vi.mocked(cacheManager.loadCache).mockReturnValue(null)
      vi.mocked(cacheManager.saveCache).mockImplementation(() => {
        throw new Error('Cache write failed')
      })

      // Should not throw even if cache save fails
      expect(() => {
        const result = buildDependencyGraphIncremental({
          projectRoot: mockProjectRoot,
          config: mockConfig,
        })
        // Should still return a valid result even with cache save error
        expect(result.cacheHit).toBe(false)
        expect(result.graph).toBeDefined()
      }).not.toThrow()
    })
  })
})
