/**
 * Tests for Vite + React Router plugin
 */

import { describe, it, expect } from 'vitest'
import { viteReactRouterPlugin } from '../../../src/plugins/vite-react-router.js'

describe('viteReactRouterPlugin', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      expect(viteReactRouterPlugin.name).toBe('Vite + React Router')
    })

    it('has correct framework identifier', () => {
      expect(viteReactRouterPlugin.framework).toBe('vite-react-router')
    })

    it('has default ignore patterns', () => {
      expect(viteReactRouterPlugin.defaultIgnorePatterns).toContain('dist/**')
      expect(viteReactRouterPlugin.defaultIgnorePatterns).toContain('.vite/**')
    })
  })

  describe('isImplicitlyUsed', () => {
    it('returns true for entry points', () => {
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/main.tsx')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/main.jsx')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/main.ts')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/main.js')).toBe(true)
    })

    it('returns true for index.html', () => {
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('index.html')).toBe(true)
    })

    it('returns true for vite config', () => {
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('vite.config.ts')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('vite.config.js')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('vite.config.mjs')).toBe(true)
    })

    it('returns true for route files in routes directory', () => {
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/routes/index.tsx')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/routes/home.tsx')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/routes/users/$id.tsx')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/routes/about/index.jsx')).toBe(true)
    })

    it('returns true for route files in pages directory', () => {
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/pages/index.tsx')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/pages/home.tsx')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/pages/users/[id].tsx')).toBe(true)
    })

    it('returns true for root route file', () => {
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/root.tsx')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/root.jsx')).toBe(true)
    })

    it('returns true for router configuration files', () => {
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/router.tsx')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/router.ts')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/routes.tsx')).toBe(true)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/routes.ts')).toBe(true)
    })

    it('returns false for regular component files', () => {
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/components/Button.tsx')).toBe(false)
      expect(viteReactRouterPlugin.isImplicitlyUsed?.('src/hooks/useAuth.ts')).toBe(false)
    })
  })

  describe('shouldIgnore', () => {
    it('returns true for dist directory', () => {
      expect(viteReactRouterPlugin.shouldIgnore?.('dist/index.js')).toBe(true)
      expect(viteReactRouterPlugin.shouldIgnore?.('dist/assets/main.js')).toBe(true)
    })

    it('returns true for .vite cache', () => {
      expect(viteReactRouterPlugin.shouldIgnore?.('.vite/deps/react.js')).toBe(true)
    })

    it('returns false for source files', () => {
      expect(viteReactRouterPlugin.shouldIgnore?.('src/App.tsx')).toBe(false)
      expect(viteReactRouterPlugin.shouldIgnore?.('src/routes/home.tsx')).toBe(false)
    })
  })

  describe('normalizePath', () => {
    it('converts backslashes to forward slashes', () => {
      expect(viteReactRouterPlugin.normalizePath?.('src\\routes\\index.tsx')).toBe('src/routes/index.tsx')
    })
  })
})
