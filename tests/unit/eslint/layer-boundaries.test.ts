/**
 * Tests for ESLint layer-boundaries rule
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Rule } from 'eslint'
import type { LayerguardConfig } from '../../../src/config/types.js'

// Mock dependencies before importing the rule
vi.mock('../../../src/eslint/config-cache.js', () => ({
  getConfig: vi.fn(),
}))

vi.mock('../../../src/parser/resolver.js', () => ({
  createResolverContext: vi.fn(() => ({})),
  resolveImport: vi.fn(),
}))

vi.mock('../../../src/enforcer/mapper.js', () => ({
  createLayerMapper: vi.fn(),
}))

vi.mock('../../../src/config/parser.js', () => ({
  parseFlowRules: vi.fn(),
}))

import { getConfig } from '../../../src/eslint/config-cache.js'
import { resolveImport, createResolverContext } from '../../../src/parser/resolver.js'
import { createLayerMapper } from '../../../src/enforcer/mapper.js'
import { parseFlowRules } from '../../../src/config/parser.js'
import rule from '../../../src/eslint/rules/layer-boundaries.js'

describe('ESLint layer-boundaries rule', () => {
  let mockContext: Rule.RuleContext
  let reportedErrors: Array<{
    messageId: string
    data?: Record<string, string>
    loc?: { start: { line: number; column: number }; end: { line: number; column: number } }
  }>

  const mockConfig: LayerguardConfig = {
    layers: {
      ui: ['src/components/**/*'],
      services: ['src/services/**/*'],
      utils: ['src/utils/**/*'],
    },
    flow: ['ui -> services', 'services -> utils'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    reportedErrors = []

    mockContext = {
      filename: 'C:/project/src/components/Button.tsx',
      getFilename: () => 'C:/project/src/components/Button.tsx',
      report: (descriptor: unknown) => {
        const d = descriptor as {
          messageId: string
          data?: Record<string, string>
          loc?: { start: { line: number; column: number }; end: { line: number; column: number } }
        }
        reportedErrors.push({
          messageId: d.messageId,
          data: d.data,
          loc: d.loc,
        })
      },
    } as unknown as Rule.RuleContext
  })

  describe('meta', () => {
    it('should have correct meta information', () => {
      expect(rule.meta).toBeDefined()
      expect(rule.meta?.type).toBe('problem')
      expect(rule.meta?.docs?.description).toContain('layer boundaries')
      expect(rule.meta?.messages?.violation).toBeDefined()
    })

    it('should have a schema for options', () => {
      expect(rule.meta?.schema).toBeDefined()
      expect(Array.isArray(rule.meta?.schema)).toBe(true)
    })
  })

  describe('create', () => {
    it('should return empty object when no config is found', () => {
      vi.mocked(getConfig).mockReturnValue(null)

      const listeners = rule.create(mockContext)

      expect(listeners).toEqual({})
    })

    it('should return empty object when source file is not in any layer', () => {
      vi.mocked(getConfig).mockReturnValue({
        config: mockConfig,
        configPath: 'C:/project/layerguard.config.ts',
        projectRoot: 'C:/project',
        loadedAt: Date.now(),
      })

      vi.mocked(createLayerMapper).mockReturnValue({
        map: vi.fn().mockReturnValue(null), // File not in any layer
        layers: mockConfig.layers,
      })

      vi.mocked(parseFlowRules).mockReturnValue([])

      const listeners = rule.create(mockContext)

      expect(listeners).toEqual({})
    })

    it('should return listeners when source file is in a layer', () => {
      vi.mocked(getConfig).mockReturnValue({
        config: mockConfig,
        configPath: 'C:/project/layerguard.config.ts',
        projectRoot: 'C:/project',
        loadedAt: Date.now(),
      })

      vi.mocked(createLayerMapper).mockReturnValue({
        map: vi.fn().mockReturnValue({ layer: 'ui', pattern: 'src/components/**/*' }),
        layers: mockConfig.layers,
      })

      vi.mocked(parseFlowRules).mockReturnValue([
        { from: 'ui', to: 'services', direction: 'unidirectional' },
      ])

      const listeners = rule.create(mockContext)

      expect(listeners.ImportDeclaration).toBeDefined()
      expect(listeners.CallExpression).toBeDefined()
      expect(listeners.ImportExpression).toBeDefined()
    })
  })

  describe('import checking', () => {
    beforeEach(() => {
      vi.mocked(getConfig).mockReturnValue({
        config: mockConfig,
        configPath: 'C:/project/layerguard.config.ts',
        projectRoot: 'C:/project',
        loadedAt: Date.now(),
      })

      vi.mocked(parseFlowRules).mockReturnValue([
        { from: 'ui', to: 'services', direction: 'unidirectional' },
        { from: 'services', to: 'utils', direction: 'unidirectional' },
      ])
    })

    it('should not report when import is allowed by flow rules', () => {
      const mockMapper = {
        map: vi.fn((path: string) => {
          if (path.includes('components')) return { layer: 'ui', pattern: 'src/components/**/*' }
          if (path.includes('services')) return { layer: 'services', pattern: 'src/services/**/*' }
          return null
        }),
        layers: mockConfig.layers,
      }

      vi.mocked(createLayerMapper).mockReturnValue(mockMapper)
      vi.mocked(resolveImport).mockReturnValue({
        resolvedPath: 'C:/project/src/services/user.ts',
        isExternal: false,
        isUnresolved: false,
      })

      const listeners = rule.create(mockContext)
      const importNode = {
        source: {
          value: '../services/user',
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        },
      }

      listeners.ImportDeclaration?.(importNode as unknown as Parameters<NonNullable<ReturnType<typeof rule.create>['ImportDeclaration']>>[0])

      expect(reportedErrors).toHaveLength(0)
    })

    it('should report when import violates flow rules', () => {
      // Set context to be in services layer
      mockContext = {
        ...mockContext,
        filename: 'C:/project/src/services/user.ts',
        getFilename: () => 'C:/project/src/services/user.ts',
      } as unknown as Rule.RuleContext

      const mockMapper = {
        map: vi.fn((path: string) => {
          if (path.includes('components')) return { layer: 'ui', pattern: 'src/components/**/*' }
          if (path.includes('services')) return { layer: 'services', pattern: 'src/services/**/*' }
          return null
        }),
        layers: mockConfig.layers,
      }

      vi.mocked(createLayerMapper).mockReturnValue(mockMapper)
      vi.mocked(resolveImport).mockReturnValue({
        resolvedPath: 'C:/project/src/components/Button.tsx',
        isExternal: false,
        isUnresolved: false,
      })

      const listeners = rule.create(mockContext)
      const importNode = {
        source: {
          value: '../components/Button',
          loc: { start: { line: 5, column: 0 }, end: { line: 5, column: 30 } },
        },
      }

      listeners.ImportDeclaration?.(importNode as unknown as Parameters<NonNullable<ReturnType<typeof rule.create>['ImportDeclaration']>>[0])

      expect(reportedErrors).toHaveLength(1)
      expect(reportedErrors[0].messageId).toBe('violation')
      expect(reportedErrors[0].data?.fromLayer).toBe('services')
      expect(reportedErrors[0].data?.toLayer).toBe('ui')
    })

    it('should not report for external imports', () => {
      const mockMapper = {
        map: vi.fn().mockReturnValue({ layer: 'ui', pattern: 'src/components/**/*' }),
        layers: mockConfig.layers,
      }

      vi.mocked(createLayerMapper).mockReturnValue(mockMapper)
      vi.mocked(resolveImport).mockReturnValue({
        resolvedPath: null,
        isExternal: true,
        isUnresolved: false,
      })

      const listeners = rule.create(mockContext)
      const importNode = {
        source: {
          value: 'react',
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 15 } },
        },
      }

      listeners.ImportDeclaration?.(importNode as unknown as Parameters<NonNullable<ReturnType<typeof rule.create>['ImportDeclaration']>>[0])

      expect(reportedErrors).toHaveLength(0)
    })

    it('should not report for same layer imports', () => {
      const mockMapper = {
        map: vi.fn().mockReturnValue({ layer: 'ui', pattern: 'src/components/**/*' }),
        layers: mockConfig.layers,
      }

      vi.mocked(createLayerMapper).mockReturnValue(mockMapper)
      vi.mocked(resolveImport).mockReturnValue({
        resolvedPath: 'C:/project/src/components/Input.tsx',
        isExternal: false,
        isUnresolved: false,
      })

      const listeners = rule.create(mockContext)
      const importNode = {
        source: {
          value: './Input',
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 15 } },
        },
      }

      listeners.ImportDeclaration?.(importNode as unknown as Parameters<NonNullable<ReturnType<typeof rule.create>['ImportDeclaration']>>[0])

      expect(reportedErrors).toHaveLength(0)
    })

    it('should handle require() calls', () => {
      // Set context to be in services layer (which cannot import from ui)
      mockContext = {
        ...mockContext,
        filename: 'C:/project/src/services/user.ts',
        getFilename: () => 'C:/project/src/services/user.ts',
      } as unknown as Rule.RuleContext

      const mockMapper = {
        map: vi.fn((path: string) => {
          if (path.includes('components')) return { layer: 'ui', pattern: 'src/components/**/*' }
          if (path.includes('services')) return { layer: 'services', pattern: 'src/services/**/*' }
          return null
        }),
        layers: mockConfig.layers,
      }

      vi.mocked(createLayerMapper).mockReturnValue(mockMapper)
      vi.mocked(resolveImport).mockReturnValue({
        resolvedPath: 'C:/project/src/components/Button.tsx',
        isExternal: false,
        isUnresolved: false,
      })

      const listeners = rule.create(mockContext)
      const callNode = {
        callee: { type: 'Identifier', name: 'require' },
        arguments: [
          {
            type: 'Literal',
            value: '../components/Button',
            loc: { start: { line: 5, column: 8 }, end: { line: 5, column: 30 } },
          },
        ],
      }

      listeners.CallExpression?.(callNode as unknown as Parameters<NonNullable<ReturnType<typeof rule.create>['CallExpression']>>[0])

      expect(reportedErrors).toHaveLength(1)
      expect(reportedErrors[0].messageId).toBe('violation')
    })

    it('should handle dynamic imports', () => {
      // Set context to be in services layer
      mockContext = {
        ...mockContext,
        filename: 'C:/project/src/services/user.ts',
        getFilename: () => 'C:/project/src/services/user.ts',
      } as unknown as Rule.RuleContext

      const mockMapper = {
        map: vi.fn((path: string) => {
          if (path.includes('components')) return { layer: 'ui', pattern: 'src/components/**/*' }
          if (path.includes('services')) return { layer: 'services', pattern: 'src/services/**/*' }
          return null
        }),
        layers: mockConfig.layers,
      }

      vi.mocked(createLayerMapper).mockReturnValue(mockMapper)
      vi.mocked(resolveImport).mockReturnValue({
        resolvedPath: 'C:/project/src/components/Button.tsx',
        isExternal: false,
        isUnresolved: false,
      })

      const listeners = rule.create(mockContext)
      const importExprNode = {
        source: {
          type: 'Literal',
          value: '../components/Button',
          loc: { start: { line: 10, column: 7 }, end: { line: 10, column: 30 } },
        },
      }

      listeners.ImportExpression?.(importExprNode as unknown as Parameters<NonNullable<ReturnType<typeof rule.create>['ImportExpression']>>[0])

      expect(reportedErrors).toHaveLength(1)
      expect(reportedErrors[0].messageId).toBe('violation')
    })

    it('should handle bidirectional flow rules', () => {
      vi.mocked(parseFlowRules).mockReturnValue([
        { from: 'ui', to: 'services', direction: 'bidirectional' },
      ])

      // Set context to be in services layer - with bidirectional rule, can import from ui
      mockContext = {
        ...mockContext,
        filename: 'C:/project/src/services/user.ts',
        getFilename: () => 'C:/project/src/services/user.ts',
      } as unknown as Rule.RuleContext

      const mockMapper = {
        map: vi.fn((path: string) => {
          if (path.includes('components')) return { layer: 'ui', pattern: 'src/components/**/*' }
          if (path.includes('services')) return { layer: 'services', pattern: 'src/services/**/*' }
          return null
        }),
        layers: mockConfig.layers,
      }

      vi.mocked(createLayerMapper).mockReturnValue(mockMapper)
      vi.mocked(resolveImport).mockReturnValue({
        resolvedPath: 'C:/project/src/components/Button.tsx',
        isExternal: false,
        isUnresolved: false,
      })

      const listeners = rule.create(mockContext)
      const importNode = {
        source: {
          value: '../components/Button',
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 25 } },
        },
      }

      listeners.ImportDeclaration?.(importNode as unknown as Parameters<NonNullable<ReturnType<typeof rule.create>['ImportDeclaration']>>[0])

      expect(reportedErrors).toHaveLength(0)
    })
  })
})
