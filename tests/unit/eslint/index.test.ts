/**
 * Tests for ESLint plugin index
 */

import { describe, it, expect } from 'vitest'
import plugin, {
  layerBoundaries,
  unlayeredImports,
  clearConfigCache,
  getCacheStats,
} from '../../../src/eslint/index.js'

describe('ESLint plugin', () => {
  describe('plugin structure', () => {
    it('should export plugin as default', () => {
      expect(plugin).toBeDefined()
    })

    it('should have meta information', () => {
      expect(plugin.meta).toBeDefined()
      expect(plugin.meta?.name).toBe('archgate')
      expect(plugin.meta?.version).toBe('0.1.0')
    })

    it('should have rules', () => {
      expect(plugin.rules).toBeDefined()
      expect(plugin.rules?.['layer-boundaries']).toBeDefined()
      expect(plugin.rules?.['unlayered-imports']).toBeDefined()
    })

    it('should have configs', () => {
      expect(plugin.configs).toBeDefined()
      expect(plugin.configs?.recommended).toBeDefined()
      expect(plugin.configs?.strict).toBeDefined()
    })
  })

  describe('recommended config', () => {
    it('should include layer-boundaries rule as error', () => {
      const config = plugin.configs?.recommended
      expect(config).toBeDefined()
      expect(config?.rules).toBeDefined()
      expect(config?.rules?.['archgate/layer-boundaries']).toBe('error')
    })

    it('should include the plugin', () => {
      const config = plugin.configs?.recommended
      expect(config?.plugins).toBeDefined()
      expect(config?.plugins?.archgate).toBeDefined()
    })

    it('should not include unlayered-imports', () => {
      const config = plugin.configs?.recommended
      expect(config?.rules?.['archgate/unlayered-imports']).toBeUndefined()
    })
  })

  describe('strict config', () => {
    it('should include layer-boundaries rule as error', () => {
      const config = plugin.configs?.strict
      expect(config).toBeDefined()
      expect(config?.rules?.['archgate/layer-boundaries']).toBe('error')
    })

    it('should include unlayered-imports rule as error', () => {
      const config = plugin.configs?.strict
      expect(config?.rules?.['archgate/unlayered-imports']).toBe('error')
    })

    it('should include the plugin', () => {
      const config = plugin.configs?.strict
      expect(config?.plugins).toBeDefined()
      expect(config?.plugins?.archgate).toBeDefined()
    })
  })

  describe('named exports', () => {
    it('should export layerBoundaries rule', () => {
      expect(layerBoundaries).toBeDefined()
      expect(layerBoundaries.meta).toBeDefined()
      expect(layerBoundaries.create).toBeDefined()
    })

    it('should export unlayeredImports rule', () => {
      expect(unlayeredImports).toBeDefined()
      expect(unlayeredImports.meta).toBeDefined()
      expect(unlayeredImports.create).toBeDefined()
    })

    it('should export clearConfigCache', () => {
      expect(clearConfigCache).toBeDefined()
      expect(typeof clearConfigCache).toBe('function')
    })

    it('should export getCacheStats', () => {
      expect(getCacheStats).toBeDefined()
      expect(typeof getCacheStats).toBe('function')
    })
  })

  describe('rules have correct meta', () => {
    it('layer-boundaries should be a problem type rule', () => {
      expect(layerBoundaries.meta?.type).toBe('problem')
    })

    it('unlayered-imports should be a problem type rule', () => {
      expect(unlayeredImports.meta?.type).toBe('problem')
    })

    it('layer-boundaries should have required messages', () => {
      expect(layerBoundaries.meta?.messages?.violation).toBeDefined()
    })

    it('unlayered-imports should have required messages', () => {
      expect(unlayeredImports.meta?.messages?.unlayeredImport).toBeDefined()
    })
  })
})
