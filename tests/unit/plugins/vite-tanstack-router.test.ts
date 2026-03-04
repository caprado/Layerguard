/**
 * Tests for Vite + TanStack Router plugin
 */

import { describe, it, expect } from 'vitest'
import { viteTanstackRouterPlugin } from '../../../src/plugins/vite-tanstack-router.js'

describe('viteTanstackRouterPlugin', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      expect(viteTanstackRouterPlugin.name).toBe('Vite + TanStack Router')
    })

    it('has correct framework identifier', () => {
      expect(viteTanstackRouterPlugin.framework).toBe('vite-tanstack-router')
    })

    it('has default ignore patterns including routeTree', () => {
      expect(viteTanstackRouterPlugin.defaultIgnorePatterns).toContain('dist/**')
      expect(viteTanstackRouterPlugin.defaultIgnorePatterns).toContain('.vite/**')
      expect(viteTanstackRouterPlugin.defaultIgnorePatterns).toContain('**/routeTree.gen.ts')
    })
  })

  describe('isImplicitlyUsed', () => {
    it('returns true for entry points', () => {
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/main.tsx')).toBe(true)
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/main.ts')).toBe(true)
    })

    it('returns true for index.html', () => {
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('index.html')).toBe(true)
    })

    it('returns true for vite config', () => {
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('vite.config.ts')).toBe(true)
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('vite.config.js')).toBe(true)
    })

    it('returns true for route files', () => {
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/routes/index.tsx')).toBe(true)
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/routes/about.tsx')).toBe(true)
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/routes/posts/$postId.tsx')).toBe(true)
    })

    it('returns true for lazy route files', () => {
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/routes/about.lazy.tsx')).toBe(true)
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/routes/posts.lazy.tsx')).toBe(true)
    })

    it('returns true for __root route', () => {
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/routes/__root.tsx')).toBe(true)
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/routes/__root.jsx')).toBe(true)
    })

    it('returns true for router configuration', () => {
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/router.tsx')).toBe(true)
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/router.ts')).toBe(true)
    })

    it('returns true for generated route tree', () => {
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/routeTree.gen.ts')).toBe(true)
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('routeTree.gen.tsx')).toBe(true)
    })

    it('returns false for regular component files', () => {
      expect(viteTanstackRouterPlugin.isImplicitlyUsed?.('src/components/Button.tsx')).toBe(false)
    })
  })

  describe('shouldIgnore', () => {
    it('returns true for dist directory', () => {
      expect(viteTanstackRouterPlugin.shouldIgnore?.('dist/index.js')).toBe(true)
    })

    it('returns true for .vite cache', () => {
      expect(viteTanstackRouterPlugin.shouldIgnore?.('.vite/deps/react.js')).toBe(true)
    })

    it('returns true for generated route tree', () => {
      expect(viteTanstackRouterPlugin.shouldIgnore?.('src/routeTree.gen.ts')).toBe(true)
      expect(viteTanstackRouterPlugin.shouldIgnore?.('routeTree.gen.tsx')).toBe(true)
    })

    it('returns false for source files', () => {
      expect(viteTanstackRouterPlugin.shouldIgnore?.('src/App.tsx')).toBe(false)
    })
  })

  describe('normalizePath', () => {
    it('converts backslashes to forward slashes', () => {
      expect(viteTanstackRouterPlugin.normalizePath?.('src\\routes\\index.tsx')).toBe('src/routes/index.tsx')
    })
  })
})
