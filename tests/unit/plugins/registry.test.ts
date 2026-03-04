/**
 * Tests for plugin registry
 */

import { describe, it, expect } from 'vitest'
import {
  getPlugin,
  getAllPlugins,
  getAvailableFrameworks,
  hasPlugin,
  registerPlugin,
  createNoopPlugin,
} from '../../../src/plugins/registry.js'
import type { FrameworkPlugin } from '../../../src/plugins/types.js'

describe('plugin registry', () => {
  describe('getPlugin', () => {
    it('should return nextjs-app plugin', () => {
      const plugin = getPlugin('nextjs-app')
      expect(plugin).toBeDefined()
      expect(plugin?.name).toBe('Next.js App Router')
    })

    it('should return nextjs-pages plugin', () => {
      const plugin = getPlugin('nextjs-pages')
      expect(plugin).toBeDefined()
      expect(plugin?.name).toBe('Next.js Pages Router')
    })

    it('should return vite-react plugin', () => {
      const plugin = getPlugin('vite-react')
      expect(plugin).toBeDefined()
      expect(plugin?.name).toBe('Vite + React')
    })

    it('should return undefined for unknown framework', () => {
      const plugin = getPlugin('unknown-framework')
      expect(plugin).toBeUndefined()
    })
  })

  describe('getAllPlugins', () => {
    it('should return all registered plugins', () => {
      const plugins = getAllPlugins()
      expect(plugins.length).toBeGreaterThanOrEqual(3)

      const names = plugins.map(p => p.framework)
      expect(names).toContain('nextjs-app')
      expect(names).toContain('nextjs-pages')
      expect(names).toContain('vite-react')
    })
  })

  describe('getAvailableFrameworks', () => {
    it('should return all framework identifiers', () => {
      const frameworks = getAvailableFrameworks()
      expect(frameworks).toContain('nextjs-app')
      expect(frameworks).toContain('nextjs-pages')
      expect(frameworks).toContain('vite-react')
    })
  })

  describe('hasPlugin', () => {
    it('should return true for registered plugins', () => {
      expect(hasPlugin('nextjs-app')).toBe(true)
      expect(hasPlugin('nextjs-pages')).toBe(true)
      expect(hasPlugin('vite-react')).toBe(true)
    })

    it('should return false for unregistered plugins', () => {
      expect(hasPlugin('unknown')).toBe(false)
    })
  })

  describe('registerPlugin', () => {
    it('should register a custom plugin', () => {
      const customPlugin: FrameworkPlugin = {
        name: 'Custom Framework',
        framework: 'custom-test',
        isImplicitlyUsed: () => false,
      }

      registerPlugin(customPlugin)

      const retrieved = getPlugin('custom-test')
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('Custom Framework')

      // Verify it appears in available frameworks
      expect(hasPlugin('custom-test')).toBe(true)
    })
  })

  describe('createNoopPlugin', () => {
    it('should create a no-op plugin', () => {
      const noop = createNoopPlugin()
      expect(noop.name).toBe('No Framework')
      expect(noop.framework).toBe('custom')
    })

    it('should have isImplicitlyUsed return false', () => {
      const noop = createNoopPlugin()
      expect(noop.isImplicitlyUsed?.('any/file.ts')).toBe(false)
    })

    it('should have shouldIgnore return false', () => {
      const noop = createNoopPlugin()
      expect(noop.shouldIgnore?.('any/file.ts')).toBe(false)
    })

    it('should have empty defaultIgnorePatterns', () => {
      const noop = createNoopPlugin()
      expect(noop.defaultIgnorePatterns).toEqual([])
    })
  })
})
