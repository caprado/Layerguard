/**
 * Tests for advanced enforcement rules (v2.7)
 */

import { describe, it, expect } from 'vitest'
import {
  checkImportDepth,
  checkPublicApi,
  checkDependentBudget,
  checkImportCount,
  checkAdvancedRules,
} from '../../../src/enforcer/advanced-rules.js'
import { LayerMapper } from '../../../src/enforcer/mapper.js'
import type { DependencyGraph } from '../../../src/parser/graph.js'
import type { LayerguardConfig } from '../../../src/config/types.js'

describe('Advanced enforcement rules', () => {
  describe('checkImportDepth', () => {
    it('should not flag chains within the limit', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['a.ts', 'b.ts', 'c.ts'],
        edges: [
          { source: 'a.ts', target: 'b.ts', specifier: './b' },
          { source: 'b.ts', target: 'c.ts', specifier: './c' },
        ],
      }

      const violations = checkImportDepth(graph, 3)

      expect(violations).toHaveLength(0)
    })

    it('should flag chains exceeding the limit', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'],
        edges: [
          { source: 'a.ts', target: 'b.ts', specifier: './b' },
          { source: 'b.ts', target: 'c.ts', specifier: './c' },
          { source: 'c.ts', target: 'd.ts', specifier: './d' },
          { source: 'd.ts', target: 'e.ts', specifier: './e' },
        ],
      }

      // maxDepth 2 means chains of length 3 (a -> b -> c) are fine
      // but a -> b -> c -> d is depth 3, exceeding limit
      const violations = checkImportDepth(graph, 2)

      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0].type).toBe('depth')
      expect(violations[0].maxDepth).toBe(2)
      expect(violations[0].actualDepth).toBeGreaterThan(2)
    })

    it('should handle circular dependencies without infinite loops', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['a.ts', 'b.ts', 'c.ts'],
        edges: [
          { source: 'a.ts', target: 'b.ts', specifier: './b' },
          { source: 'b.ts', target: 'c.ts', specifier: './c' },
          { source: 'c.ts', target: 'a.ts', specifier: './a' }, // cycle back to a
        ],
      }

      // Should not hang or crash
      const violations = checkImportDepth(graph, 2)

      expect(Array.isArray(violations)).toBe(true)
    })

    it('should handle disconnected subgraphs', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['a.ts', 'b.ts', 'x.ts', 'y.ts'],
        edges: [
          { source: 'a.ts', target: 'b.ts', specifier: './b' },
          { source: 'x.ts', target: 'y.ts', specifier: './y' },
        ],
      }

      const violations = checkImportDepth(graph, 1)

      expect(violations).toHaveLength(0)
    })

    it('should provide detailed violation info', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
        edges: [
          { source: 'a.ts', target: 'b.ts', specifier: './b' },
          { source: 'b.ts', target: 'c.ts', specifier: './c' },
          { source: 'c.ts', target: 'd.ts', specifier: './d' },
        ],
      }

      const violations = checkImportDepth(graph, 1)

      const violation = violations.find(v => v.sourceFile === 'a.ts')
      expect(violation).toBeDefined()
      expect(violation?.importChain).toContain('a.ts')
      expect(violation?.message).toContain('Import chain too deep')
      expect(violation?.suggestion).toBeDefined()
    })
  })

  describe('checkPublicApi', () => {
    const createConfig = (publicApi?: string | string[]): LayerguardConfig => ({
      layers: {
        ui: { path: 'src/ui' },
        services: {
          path: 'src/services',
          publicApi,
        },
      },
      flow: ['ui -> services'],
    })

    it('should not flag imports when no publicApi is configured', () => {
      const config = createConfig()
      const mapper = new LayerMapper(config)
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['src/ui/Button.tsx', 'src/services/internal/helper.ts'],
        edges: [
          {
            source: 'src/ui/Button.tsx',
            target: 'src/services/internal/helper.ts',
            specifier: '../services/internal/helper',
          },
        ],
      }

      const violations = checkPublicApi(graph, config, mapper)

      expect(violations).toHaveLength(0)
    })

    it('should flag imports to non-public files', () => {
      const config = createConfig('index.ts')
      const mapper = new LayerMapper(config)
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['src/ui/Button.tsx', 'src/services/internal/helper.ts'],
        edges: [
          {
            source: 'src/ui/Button.tsx',
            target: 'src/services/internal/helper.ts',
            specifier: '../services/internal/helper',
          },
        ],
      }

      const violations = checkPublicApi(graph, config, mapper)

      expect(violations).toHaveLength(1)
      expect(violations[0].type).toBe('publicApi')
      expect(violations[0].targetLayer).toBe('services')
      expect(violations[0].publicApiFiles).toContain('index.ts')
    })

    it('should allow imports to public API files', () => {
      const config = createConfig('index.ts')
      const mapper = new LayerMapper(config)
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['src/ui/Button.tsx', 'src/services/index.ts'],
        edges: [
          {
            source: 'src/ui/Button.tsx',
            target: 'src/services/index.ts',
            specifier: '../services',
          },
        ],
      }

      const violations = checkPublicApi(graph, config, mapper)

      expect(violations).toHaveLength(0)
    })

    it('should support multiple public API files', () => {
      const config = createConfig(['index.ts', 'types.ts'])
      const mapper = new LayerMapper(config)
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['src/ui/Button.tsx', 'src/services/types.ts', 'src/services/internal.ts'],
        edges: [
          {
            source: 'src/ui/Button.tsx',
            target: 'src/services/types.ts',
            specifier: '../services/types',
          },
        ],
      }

      const violations = checkPublicApi(graph, config, mapper)

      expect(violations).toHaveLength(0)
    })

    it('should allow intra-layer imports regardless of publicApi', () => {
      const config = createConfig('index.ts')
      const mapper = new LayerMapper(config)
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['src/services/user.ts', 'src/services/internal/helper.ts'],
        edges: [
          {
            source: 'src/services/user.ts',
            target: 'src/services/internal/helper.ts',
            specifier: './internal/helper',
          },
        ],
      }

      const violations = checkPublicApi(graph, config, mapper)

      expect(violations).toHaveLength(0)
    })
  })

  describe('checkDependentBudget', () => {
    const createConfig = (maxDependents?: number): LayerguardConfig => ({
      layers: {
        ui: { path: 'src/ui' },
        services: { path: 'src/services' },
        utils: {
          path: 'src/utils',
          maxDependents,
        },
        hooks: { path: 'src/hooks' },
      },
      flow: ['ui -> utils', 'services -> utils', 'hooks -> utils'],
    })

    it('should not flag when no maxDependents is configured', () => {
      const config = createConfig()
      const mapper = new LayerMapper(config)
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['src/ui/a.ts', 'src/services/b.ts', 'src/utils/c.ts'],
        edges: [
          { source: 'src/ui/a.ts', target: 'src/utils/c.ts', specifier: '../utils/c' },
          { source: 'src/services/b.ts', target: 'src/utils/c.ts', specifier: '../utils/c' },
        ],
      }

      const violations = checkDependentBudget(graph, config, mapper)

      expect(violations).toHaveLength(0)
    })

    it('should not flag when within budget', () => {
      const config = createConfig(3)
      const mapper = new LayerMapper(config)
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['src/ui/a.ts', 'src/services/b.ts', 'src/utils/c.ts'],
        edges: [
          { source: 'src/ui/a.ts', target: 'src/utils/c.ts', specifier: '../utils/c' },
          { source: 'src/services/b.ts', target: 'src/utils/c.ts', specifier: '../utils/c' },
        ],
      }

      const violations = checkDependentBudget(graph, config, mapper)

      expect(violations).toHaveLength(0)
    })

    it('should flag when exceeding budget', () => {
      const config = createConfig(1)
      const mapper = new LayerMapper(config)
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['src/ui/a.ts', 'src/services/b.ts', 'src/hooks/c.ts', 'src/utils/d.ts'],
        edges: [
          { source: 'src/ui/a.ts', target: 'src/utils/d.ts', specifier: '../utils/d' },
          { source: 'src/services/b.ts', target: 'src/utils/d.ts', specifier: '../utils/d' },
          { source: 'src/hooks/c.ts', target: 'src/utils/d.ts', specifier: '../utils/d' },
        ],
      }

      const violations = checkDependentBudget(graph, config, mapper)

      expect(violations).toHaveLength(1)
      expect(violations[0].type).toBe('dependentBudget')
      expect(violations[0].targetLayer).toBe('utils')
      expect(violations[0].maxDependents).toBe(1)
      expect(violations[0].actualDependents).toBe(3)
      expect(violations[0].dependentLayers).toContain('ui')
      expect(violations[0].dependentLayers).toContain('services')
      expect(violations[0].dependentLayers).toContain('hooks')
    })

    it('should provide helpful suggestion', () => {
      const config = createConfig(1)
      const mapper = new LayerMapper(config)
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['src/ui/a.ts', 'src/services/b.ts', 'src/utils/c.ts'],
        edges: [
          { source: 'src/ui/a.ts', target: 'src/utils/c.ts', specifier: '../utils/c' },
          { source: 'src/services/b.ts', target: 'src/utils/c.ts', specifier: '../utils/c' },
        ],
      }

      const violations = checkDependentBudget(graph, config, mapper)

      expect(violations[0].message).toContain('too many dependents')
      expect(violations[0].suggestion).toContain('splitting')
    })
  })

  describe('checkImportCount', () => {
    it('should not flag files within the limit', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['a.ts', 'b.ts', 'c.ts'],
        edges: [
          { source: 'a.ts', target: 'b.ts', specifier: './b' },
          { source: 'a.ts', target: 'c.ts', specifier: './c' },
        ],
      }

      const violations = checkImportCount(graph, 5)

      expect(violations).toHaveLength(0)
    })

    it('should flag files exceeding the limit', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'],
        edges: [
          { source: 'a.ts', target: 'b.ts', specifier: './b' },
          { source: 'a.ts', target: 'c.ts', specifier: './c' },
          { source: 'a.ts', target: 'd.ts', specifier: './d' },
          { source: 'a.ts', target: 'e.ts', specifier: './e' },
        ],
      }

      const violations = checkImportCount(graph, 2)

      expect(violations).toHaveLength(1)
      expect(violations[0].type).toBe('importCount')
      expect(violations[0].sourceFile).toBe('a.ts')
      expect(violations[0].maxImports).toBe(2)
      expect(violations[0].actualImports).toBe(4)
    })

    it('should flag multiple files', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'],
        edges: [
          { source: 'a.ts', target: 'c.ts', specifier: './c' },
          { source: 'a.ts', target: 'd.ts', specifier: './d' },
          { source: 'a.ts', target: 'e.ts', specifier: './e' },
          { source: 'b.ts', target: 'c.ts', specifier: './c' },
          { source: 'b.ts', target: 'd.ts', specifier: './d' },
          { source: 'b.ts', target: 'e.ts', specifier: './e' },
        ],
      }

      const violations = checkImportCount(graph, 2)

      expect(violations).toHaveLength(2)
      expect(violations.map(v => v.sourceFile)).toContain('a.ts')
      expect(violations.map(v => v.sourceFile)).toContain('b.ts')
    })

    it('should provide helpful suggestion', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
        edges: [
          { source: 'a.ts', target: 'b.ts', specifier: './b' },
          { source: 'a.ts', target: 'c.ts', specifier: './c' },
          { source: 'a.ts', target: 'd.ts', specifier: './d' },
        ],
      }

      const violations = checkImportCount(graph, 1)

      expect(violations[0].message).toContain('Too many imports')
      expect(violations[0].suggestion).toContain('splitting')
    })
  })

  describe('checkAdvancedRules', () => {
    const config: LayerguardConfig = {
      layers: {
        ui: { path: 'src/ui' },
        services: {
          path: 'src/services',
          publicApi: 'index.ts',
          maxDependents: 1,
        },
      },
      flow: ['ui -> services'],
    }
    const mapper = new LayerMapper(config)

    it('should check all configured rules', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['src/ui/a.ts', 'src/ui/b.ts', 'src/services/internal.ts'],
        edges: [
          // Public API violation
          { source: 'src/ui/a.ts', target: 'src/services/internal.ts', specifier: '../services/internal' },
          // Multiple imports for import count check
          { source: 'src/ui/b.ts', target: 'src/services/internal.ts', specifier: '../services/internal' },
        ],
      }

      const violations = checkAdvancedRules(graph, config, mapper, {
        maxImportDepth: 5,
        maxImportsPerFile: 10,
      })

      // Should find publicApi violations
      const publicApiViolations = violations.filter(v => v.type === 'publicApi')
      expect(publicApiViolations.length).toBeGreaterThan(0)
    })

    it('should skip rules that are not configured', () => {
      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts'],
        edges: [
          { source: 'a.ts', target: 'b.ts', specifier: './b' },
          { source: 'a.ts', target: 'c.ts', specifier: './c' },
          { source: 'a.ts', target: 'd.ts', specifier: './d' },
          { source: 'a.ts', target: 'e.ts', specifier: './e' },
          { source: 'a.ts', target: 'f.ts', specifier: './f' },
        ],
      }

      // Don't pass maxImportDepth or maxImportsPerFile
      const violations = checkAdvancedRules(graph, config, mapper, {})

      // Should not have depth or importCount violations
      const depthViolations = violations.filter(v => v.type === 'depth')
      const importCountViolations = violations.filter(v => v.type === 'importCount')
      expect(depthViolations).toHaveLength(0)
      expect(importCountViolations).toHaveLength(0)
    })
  })
})
