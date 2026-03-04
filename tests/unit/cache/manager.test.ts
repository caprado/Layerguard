import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  loadCache,
  saveCache,
  clearCache,
  validateCache,
  graphToCache,
  cacheToGraph,
  updateCacheFiles,
  getCachePath,
  getFileMtime,
  hashConfig,
} from '../../../src/cache/manager.js'
import { CACHE_VERSION } from '../../../src/cache/types.js'
import type { CacheData, CachedFile } from '../../../src/cache/types.js'
import type { DependencyGraph } from '../../../src/parser/graph.js'
import type { LayerguardConfig } from '../../../src/config/types.js'

vi.mock('node:fs')
vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path')
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.join('/')),
    dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
  }
})

describe('cache manager', () => {
  const mockProjectRoot = '/project'
  const mockCachePath = '/project/.layerguard-cache/graph.json'

  const mockConfig: LayerguardConfig = {
    layers: {
      components: { path: 'src/components' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> utils'],
  }

  const mockCacheData: CacheData = {
    version: CACHE_VERSION,
    timestamp: Date.now(),
    projectRoot: mockProjectRoot,
    configHash: 'abc123',
    files: {
      'src/index.ts': {
        mtime: 1000,
        edges: [
          {
            source: 'src/index.ts',
            target: 'src/utils.ts',
            specifier: './utils',
            isTypeOnly: false,
            kind: 'static',
            line: 1,
          },
        ],
      },
      'src/utils.ts': {
        mtime: 2000,
        edges: [],
      },
    },
    externalImports: ['react'],
    unresolvedImports: [],
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCachePath', () => {
    it('returns correct cache path', () => {
      const result = getCachePath('/my/project')
      expect(result).toContain('.layerguard-cache')
      expect(result).toContain('graph.json')
    })
  })

  describe('getFileMtime', () => {
    it('returns mtime for existing file', () => {
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: 12345,
      } as fs.Stats)

      const result = getFileMtime('/some/file.ts')
      expect(result).toBe(12345)
    })

    it('returns null for non-existent file', () => {
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error('ENOENT')
      })

      const result = getFileMtime('/missing/file.ts')
      expect(result).toBeNull()
    })
  })

  describe('hashConfig', () => {
    it('returns consistent hash for same config', () => {
      const hash1 = hashConfig(mockConfig)
      const hash2 = hashConfig(mockConfig)
      expect(hash1).toBe(hash2)
    })

    it('returns different hash for different config', () => {
      const hash1 = hashConfig(mockConfig)
      const hash2 = hashConfig({ ...mockConfig, flow: ['utils -> components'] })
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('loadCache', () => {
    it('returns null when cache file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = loadCache(mockProjectRoot)
      expect(result).toBeNull()
    })

    it('returns cache data when file exists and is valid', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockCacheData))

      const result = loadCache(mockProjectRoot)
      expect(result).toEqual(mockCacheData)
    })

    it('returns null when cache has wrong version', () => {
      const oldCache = { ...mockCacheData, version: '0.0.1' }
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(oldCache))

      const result = loadCache(mockProjectRoot)
      expect(result).toBeNull()
    })

    it('returns null when cache file is invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json')

      const result = loadCache(mockProjectRoot)
      expect(result).toBeNull()
    })
  })

  describe('saveCache', () => {
    it('creates cache directory if not exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      saveCache(mockProjectRoot, mockCacheData)

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.layerguard-cache'),
        { recursive: true }
      )
    })

    it('writes cache file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      saveCache(mockProjectRoot, mockCacheData)

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('graph.json'),
        expect.any(String),
        'utf-8'
      )
    })
  })

  describe('clearCache', () => {
    it('returns false when cache does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const result = clearCache(mockProjectRoot)
      expect(result).toBe(false)
    })
  })

  describe('validateCache', () => {
    it('returns invalid when version mismatch', () => {
      const cache = { ...mockCacheData, version: '0.0.1' }
      const result = validateCache(cache, mockProjectRoot, [], mockConfig)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('version')
    })

    it('returns invalid when project root changed', () => {
      const result = validateCache(mockCacheData, '/different/root', [], mockConfig)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('root')
    })

    it('returns invalid when config changed', () => {
      const cache = { ...mockCacheData, configHash: 'different' }
      const result = validateCache(cache, mockProjectRoot, [], mockConfig)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Config')
    })

    it('returns valid with changed files when mtimes differ', () => {
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 9999 } as fs.Stats)

      const cache: CacheData = {
        ...mockCacheData,
        configHash: hashConfig(mockConfig),
      }

      const currentFiles = ['src/index.ts', 'src/utils.ts']
      const result = validateCache(cache, mockProjectRoot, currentFiles, mockConfig)

      expect(result.valid).toBe(true)
      expect(result.changedFiles?.length).toBeGreaterThan(0)
    })

    it('returns valid with new files', () => {
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats)

      const cache: CacheData = {
        ...mockCacheData,
        configHash: hashConfig(mockConfig),
      }

      const currentFiles = ['src/index.ts', 'src/utils.ts', 'src/new.ts']
      const result = validateCache(cache, mockProjectRoot, currentFiles, mockConfig)

      expect(result.valid).toBe(true)
      expect(result.newFiles).toContain('src/new.ts')
    })

    it('returns valid with deleted files', () => {
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 1000 } as fs.Stats)

      const cache: CacheData = {
        ...mockCacheData,
        configHash: hashConfig(mockConfig),
      }

      const currentFiles = ['src/index.ts'] // utils.ts removed
      const result = validateCache(cache, mockProjectRoot, currentFiles, mockConfig)

      expect(result.valid).toBe(true)
      expect(result.deletedFiles).toContain('src/utils.ts')
    })

    it('returns valid without changes when everything matches', () => {
      vi.mocked(fs.statSync).mockImplementation((p) => {
        const path = String(p)
        if (path.includes('index')) return { mtimeMs: 1000 } as fs.Stats
        if (path.includes('utils')) return { mtimeMs: 2000 } as fs.Stats
        return { mtimeMs: 0 } as fs.Stats
      })

      const cache: CacheData = {
        ...mockCacheData,
        configHash: hashConfig(mockConfig),
      }

      const currentFiles = ['src/index.ts', 'src/utils.ts']
      const result = validateCache(cache, mockProjectRoot, currentFiles, mockConfig)

      expect(result.valid).toBe(true)
      expect(result.changedFiles).toBeUndefined()
      expect(result.newFiles).toBeUndefined()
      expect(result.deletedFiles).toBeUndefined()
    })
  })

  describe('graphToCache', () => {
    it('converts graph to cache format', () => {
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 5000 } as fs.Stats)

      const graph: DependencyGraph = {
        projectRoot: mockProjectRoot,
        files: new Set(['src/a.ts', 'src/b.ts']),
        adjacencyList: new Map([
          ['src/a.ts', new Set(['src/b.ts'])],
          ['src/b.ts', new Set()],
        ]),
        edges: [
          {
            source: 'src/a.ts',
            target: 'src/b.ts',
            specifier: './b',
            isTypeOnly: false,
            kind: 'static',
            line: 1,
          },
        ],
        parseErrors: new Map(),
        unresolvedImports: [],
        externalImports: new Set(['react']),
      }

      const cache = graphToCache(graph, mockConfig)

      expect(cache.version).toBe(CACHE_VERSION)
      expect(cache.projectRoot).toBe(mockProjectRoot)
      expect(cache.files['src/a.ts']).toBeDefined()
      expect(cache.files['src/b.ts']).toBeDefined()
      expect(cache.externalImports).toContain('react')
    })

    it('includes parse errors in cache', () => {
      vi.mocked(fs.statSync).mockReturnValue({ mtimeMs: 5000 } as fs.Stats)

      const graph: DependencyGraph = {
        projectRoot: mockProjectRoot,
        files: new Set(['src/broken.ts']),
        adjacencyList: new Map([['src/broken.ts', new Set()]]),
        edges: [],
        parseErrors: new Map([['src/broken.ts', ['Syntax error']]]),
        unresolvedImports: [],
        externalImports: new Set(),
      }

      const cache = graphToCache(graph, mockConfig)

      expect(cache.files['src/broken.ts']?.parseErrors).toContain('Syntax error')
    })
  })

  describe('cacheToGraph', () => {
    it('converts cache to graph format', () => {
      const graph = cacheToGraph(mockCacheData)

      expect(graph.projectRoot).toBe(mockProjectRoot)
      expect(graph.files.has('src/index.ts')).toBe(true)
      expect(graph.files.has('src/utils.ts')).toBe(true)
      expect(graph.edges.length).toBe(1)
      expect(graph.externalImports.has('react')).toBe(true)
    })

    it('builds adjacency list correctly', () => {
      const graph = cacheToGraph(mockCacheData)

      const indexTargets = graph.adjacencyList.get('src/index.ts')
      expect(indexTargets?.has('src/utils.ts')).toBe(true)
    })

    it('preserves parse errors', () => {
      const cacheWithErrors: CacheData = {
        ...mockCacheData,
        files: {
          'src/broken.ts': {
            mtime: 1000,
            edges: [],
            parseErrors: ['Parse error'],
          },
        },
      }

      const graph = cacheToGraph(cacheWithErrors)
      expect(graph.parseErrors.get('src/broken.ts')).toContain('Parse error')
    })
  })

  describe('updateCacheFiles', () => {
    it('removes deleted files from cache', () => {
      const updatedCache = updateCacheFiles(
        mockCacheData,
        new Map(),
        ['src/utils.ts']
      )

      expect(updatedCache.files['src/utils.ts']).toBeUndefined()
      expect(updatedCache.files['src/index.ts']).toBeDefined()
    })

    it('adds/updates changed files', () => {
      const newFile: CachedFile = {
        mtime: 9999,
        edges: [],
      }

      const updatedCache = updateCacheFiles(
        mockCacheData,
        new Map([['src/new.ts', newFile]]),
        []
      )

      expect(updatedCache.files['src/new.ts']).toEqual(newFile)
    })

    it('filters unresolved imports from deleted sources', () => {
      const cacheWithUnresolved: CacheData = {
        ...mockCacheData,
        unresolvedImports: [
          { source: 'src/utils.ts', specifier: './missing' },
          { source: 'src/index.ts', specifier: './other' },
        ],
      }

      const updatedCache = updateCacheFiles(
        cacheWithUnresolved,
        new Map(),
        ['src/utils.ts']
      )

      expect(updatedCache.unresolvedImports).toHaveLength(1)
      expect(updatedCache.unresolvedImports[0]?.source).toBe('src/index.ts')
    })

    it('updates timestamp', () => {
      const oldTimestamp = mockCacheData.timestamp
      const updatedCache = updateCacheFiles(mockCacheData, new Map(), [])

      expect(updatedCache.timestamp).toBeGreaterThanOrEqual(oldTimestamp)
    })
  })
})
