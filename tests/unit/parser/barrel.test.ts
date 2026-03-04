import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import {
  analyzeBarrel,
  resolveBarrelOrigins,
  clearBarrelCache,
  isLikelyBarrelFile,
} from '../../../src/parser/barrel.js'
import * as resolver from '../../../src/parser/resolver.js'

vi.mock('node:fs')
vi.mock('../../../src/parser/resolver.js')

describe('barrel tracer', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clearBarrelCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isLikelyBarrelFile', () => {
    it('returns true for index.ts', () => {
      expect(isLikelyBarrelFile('src/services/index.ts')).toBe(true)
    })

    it('returns true for index.js', () => {
      expect(isLikelyBarrelFile('src/utils/index.js')).toBe(true)
    })

    it('returns true for index.tsx', () => {
      expect(isLikelyBarrelFile('components/index.tsx')).toBe(true)
    })

    it('returns false for regular files', () => {
      expect(isLikelyBarrelFile('src/services/userService.ts')).toBe(false)
    })

    it('returns false for files with index in the name', () => {
      expect(isLikelyBarrelFile('src/utils/indexHelper.ts')).toBe(false)
    })

    it('handles Windows paths', () => {
      expect(isLikelyBarrelFile('src\\services\\index.ts')).toBe(true)
    })
  })

  describe('analyzeBarrel', () => {
    it('returns isBarrel: false for non-barrel files', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(`
        export function doSomething() {}
        export const value = 42
      `)

      const result = analyzeBarrel('/project/src/utils.ts')
      expect(result.isBarrel).toBe(false)
      expect(result.reexports).toHaveLength(0)
    })

    it('detects wildcard re-exports', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(`
        export * from './userService'
        export * from './orderService'
      `)

      const result = analyzeBarrel('/project/src/services/index.ts')
      expect(result.isBarrel).toBe(true)
      expect(result.reexports).toHaveLength(2)
      expect(result.reexports[0]?.isWildcard).toBe(true)
      expect(result.reexports[0]?.specifier).toBe('./userService')
    })

    it('detects named re-exports', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(`
        export { findUser, createUser } from './userService'
        export { processOrder } from './orderService'
      `)

      const result = analyzeBarrel('/project/src/services/index.ts')
      expect(result.isBarrel).toBe(true)
      expect(result.reexports).toHaveLength(2)
      expect(result.reexports[0]?.namedExports).toContain('findUser')
      expect(result.reexports[0]?.namedExports).toContain('createUser')
    })

    it('detects namespace re-exports', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(`
        export * as utils from './utils'
      `)

      const result = analyzeBarrel('/project/src/index.ts')
      expect(result.isBarrel).toBe(true)
      expect(result.reexports).toHaveLength(1)
      expect(result.reexports[0]?.namedExports).toContain('utils')
    })

    it('detects type-only re-exports', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(`
        export type { User, Order } from './types'
      `)

      const result = analyzeBarrel('/project/src/index.ts')
      expect(result.isBarrel).toBe(true)
      expect(result.reexports[0]?.isTypeOnly).toBe(true)
    })

    it('returns empty result for unreadable files', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT')
      })

      const result = analyzeBarrel('/project/missing.ts')
      expect(result.isBarrel).toBe(false)
      expect(result.reexports).toHaveLength(0)
    })

    it('caches results', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(`export * from './a'`)

      analyzeBarrel('/project/index.ts')
      analyzeBarrel('/project/index.ts')

      // Should only read once due to caching
      expect(fs.readFileSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('resolveBarrelOrigins', () => {
    it('returns original path for non-barrel files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)
      vi.mocked(fs.readFileSync).mockReturnValue(`
        export function doSomething() {}
      `)

      const context = {
        compilerOptions: {},
        moduleResolutionHost: {} as any,
        projectRoot: '/project',
      }

      const origins = resolveBarrelOrigins('/project/src/utils.ts', context)
      expect(origins).toEqual(['/project/src/utils.ts'])
    })

    it('returns original path for non-existent files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = {
        compilerOptions: {},
        moduleResolutionHost: {} as any,
        projectRoot: '/project',
      }

      const origins = resolveBarrelOrigins('/project/missing.ts', context)
      expect(origins).toEqual(['/project/missing.ts'])
    })

    it('traces re-exports to origin files', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true)

      // First call: barrel file
      // Second call: target file (not a barrel)
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(`export * from './repository/users'`)
        .mockReturnValueOnce(`export function findUser() {}`)

      vi.mocked(resolver.resolveImport).mockReturnValue({
        specifier: './repository/users',
        resolvedPath: '/project/src/repository/users.ts',
        isExternal: false,
        isUnresolved: false,
      })

      const context = {
        compilerOptions: {},
        moduleResolutionHost: {} as any,
        projectRoot: '/project',
      }

      const origins = resolveBarrelOrigins('/project/src/services/index.ts', context)
      expect(origins).toContain('/project/src/repository/users.ts')
    })
  })
})
