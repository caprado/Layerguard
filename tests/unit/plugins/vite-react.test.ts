/**
 * Tests for Vite React plugin
 */

import { describe, it, expect } from 'vitest'
import { viteReactPlugin } from '../../../src/plugins/vite-react.js'

describe('viteReactPlugin', () => {
  describe('metadata', () => {
    it('should have correct name and framework', () => {
      expect(viteReactPlugin.name).toBe('Vite + React')
      expect(viteReactPlugin.framework).toBe('vite-react')
    })

    it('should have default ignore patterns', () => {
      expect(viteReactPlugin.defaultIgnorePatterns).toContain('dist/**')
      expect(viteReactPlugin.defaultIgnorePatterns).toContain('.vite/**')
    })
  })

  describe('isImplicitlyUsed', () => {
    describe('main entry point', () => {
      it('should recognize main.tsx', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('src/main.tsx')).toBe(true)
      })

      it('should recognize main.ts', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('src/main.ts')).toBe(true)
      })

      it('should recognize main.jsx', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('src/main.jsx')).toBe(true)
      })

      it('should recognize main.js', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('src/main.js')).toBe(true)
      })

      it('should not recognize main outside src/', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('main.tsx')).toBe(false)
        expect(viteReactPlugin.isImplicitlyUsed?.('lib/main.tsx')).toBe(false)
      })
    })

    describe('index.html', () => {
      it('should recognize index.html', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('index.html')).toBe(true)
      })

      it('should not recognize index.html in subdirectories', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('public/index.html')).toBe(false)
      })
    })

    describe('vite.config', () => {
      it('should recognize vite.config.ts', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('vite.config.ts')).toBe(true)
      })

      it('should recognize vite.config.js', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('vite.config.js')).toBe(true)
      })

      it('should recognize vite.config.mjs', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('vite.config.mjs')).toBe(true)
      })

      it('should not recognize vite.config in subdirectories', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('config/vite.config.ts')).toBe(false)
      })
    })

    describe('regular files', () => {
      it('should not recognize regular components', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('src/App.tsx')).toBe(false)
        expect(viteReactPlugin.isImplicitlyUsed?.('src/components/Button.tsx')).toBe(false)
      })

      it('should not recognize other files', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('src/utils.ts')).toBe(false)
      })
    })

    describe('Windows paths', () => {
      it('should handle Windows backslash paths', () => {
        expect(viteReactPlugin.isImplicitlyUsed?.('src\\main.tsx')).toBe(true)
      })
    })
  })

  describe('shouldIgnore', () => {
    it('should ignore dist directory', () => {
      expect(viteReactPlugin.shouldIgnore?.('dist/index.js')).toBe(true)
      expect(viteReactPlugin.shouldIgnore?.('dist/assets/main.js')).toBe(true)
    })

    it('should ignore .vite cache', () => {
      expect(viteReactPlugin.shouldIgnore?.('.vite/deps/react.js')).toBe(true)
    })

    it('should not ignore regular source files', () => {
      expect(viteReactPlugin.shouldIgnore?.('src/main.tsx')).toBe(false)
      expect(viteReactPlugin.shouldIgnore?.('src/App.tsx')).toBe(false)
    })
  })

  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(viteReactPlugin.normalizePath?.('src\\components\\Button.tsx')).toBe('src/components/Button.tsx')
    })

    it('should keep path intact', () => {
      expect(viteReactPlugin.normalizePath?.('src/utils.ts')).toBe('src/utils.ts')
    })
  })
})
