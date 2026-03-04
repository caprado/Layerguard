/**
 * Tests for Vue / Nuxt plugin
 */

import { describe, it, expect } from 'vitest'
import { vueNuxtPlugin } from '../../../src/plugins/vue-nuxt.js'

describe('vueNuxtPlugin', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      expect(vueNuxtPlugin.name).toBe('Vue / Nuxt')
    })

    it('has correct framework identifier', () => {
      expect(vueNuxtPlugin.framework).toBe('vue-nuxt')
    })

    it('has default ignore patterns', () => {
      expect(vueNuxtPlugin.defaultIgnorePatterns).toContain('dist/**')
      expect(vueNuxtPlugin.defaultIgnorePatterns).toContain('.nuxt/**')
      expect(vueNuxtPlugin.defaultIgnorePatterns).toContain('.output/**')
    })
  })

  describe('isImplicitlyUsed', () => {
    it('returns true for Vue entry points', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('src/main.ts')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('src/main.js')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('src/App.vue')).toBe(true)
    })

    it('returns true for Nuxt app.vue', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('app.vue')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('App.vue')).toBe(true)
    })

    it('returns true for configuration files', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('nuxt.config.ts')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('nuxt.config.js')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('vite.config.ts')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('vue.config.js')).toBe(true)
    })

    it('returns true for index.html', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('index.html')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('public/index.html')).toBe(true)
    })

    it('returns true for .vue files', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('src/components/Button.vue')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('components/Card.vue')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('pages/index.vue')).toBe(true)
    })

    it('returns true for files in pages directory', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('pages/index.vue')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('pages/about.vue')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('src/pages/users/[id].vue')).toBe(true)
    })

    it('returns true for Nuxt auto-import directories', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('components/Header.vue')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('composables/useAuth.ts')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('utils/helpers.ts')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('middleware/auth.ts')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('plugins/api.ts')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('layouts/default.vue')).toBe(true)
    })

    it('returns true for server directory', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('server/api/users.ts')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('server/middleware/auth.ts')).toBe(true)
    })

    it('returns true for app config', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('app.config.ts')).toBe(true)
      expect(vueNuxtPlugin.isImplicitlyUsed?.('app.config.js')).toBe(true)
    })

    it('returns true for error page', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('error.vue')).toBe(true)
    })

    it('returns false for regular TypeScript files outside special dirs', () => {
      expect(vueNuxtPlugin.isImplicitlyUsed?.('lib/helpers.ts')).toBe(false)
    })
  })

  describe('shouldIgnore', () => {
    it('returns true for dist directory', () => {
      expect(vueNuxtPlugin.shouldIgnore?.('dist/index.js')).toBe(true)
    })

    it('returns true for .nuxt directory', () => {
      expect(vueNuxtPlugin.shouldIgnore?.('.nuxt/components.d.ts')).toBe(true)
    })

    it('returns true for .output directory', () => {
      expect(vueNuxtPlugin.shouldIgnore?.('.output/server/index.mjs')).toBe(true)
    })

    it('returns true for .vite cache', () => {
      expect(vueNuxtPlugin.shouldIgnore?.('.vite/deps/vue.js')).toBe(true)
    })

    it('returns false for source files', () => {
      expect(vueNuxtPlugin.shouldIgnore?.('src/App.vue')).toBe(false)
    })
  })

  describe('normalizePath', () => {
    it('converts backslashes to forward slashes', () => {
      expect(vueNuxtPlugin.normalizePath?.('pages\\users\\[id].vue')).toBe('pages/users/[id].vue')
    })
  })
})
