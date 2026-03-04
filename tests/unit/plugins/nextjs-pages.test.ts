/**
 * Tests for Next.js Pages Router plugin
 */

import { describe, it, expect } from 'vitest'
import { nextjsPagesPlugin } from '../../../src/plugins/nextjs-pages.js'

describe('nextjsPagesPlugin', () => {
  describe('metadata', () => {
    it('should have correct name and framework', () => {
      expect(nextjsPagesPlugin.name).toBe('Next.js Pages Router')
      expect(nextjsPagesPlugin.framework).toBe('nextjs-pages')
    })

    it('should have default ignore patterns', () => {
      expect(nextjsPagesPlugin.defaultIgnorePatterns).toContain('.next/**')
      expect(nextjsPagesPlugin.defaultIgnorePatterns).toContain('out/**')
      expect(nextjsPagesPlugin.defaultIgnorePatterns).toContain('next-env.d.ts')
    })
  })

  describe('isImplicitlyUsed', () => {
    describe('_app files', () => {
      it('should recognize _app in pages directory', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/_app.tsx')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/_app.ts')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/_app.jsx')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/_app.js')).toBe(true)
      })

      it('should recognize _app in src/pages directory', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('src/pages/_app.tsx')).toBe(true)
      })
    })

    describe('_document files', () => {
      it('should recognize _document in pages directory', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/_document.tsx')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('src/pages/_document.tsx')).toBe(true)
      })
    })

    describe('_error files', () => {
      it('should recognize _error in pages directory', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/_error.tsx')).toBe(true)
      })
    })

    describe('404 and 500 pages', () => {
      it('should recognize 404 page', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/404.tsx')).toBe(true)
      })

      it('should recognize 500 page', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/500.tsx')).toBe(true)
      })
    })

    describe('route pages', () => {
      it('should recognize index page', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/index.tsx')).toBe(true)
      })

      it('should recognize route pages', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/about.tsx')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/users/index.tsx')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/users/[id].tsx')).toBe(true)
      })

      it('should recognize API routes', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/api/hello.ts')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/api/users/[id].ts')).toBe(true)
      })

      it('should recognize pages in src/pages', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('src/pages/index.tsx')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('src/pages/api/hello.ts')).toBe(true)
      })
    })

    describe('middleware', () => {
      it('should recognize middleware at root', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('middleware.ts')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('middleware.tsx')).toBe(true)
      })

      it('should recognize middleware in src/', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('src/middleware.ts')).toBe(true)
      })

      it('should not recognize middleware in pages/', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/middleware.ts')).toBe(false)
      })
    })

    describe('proxy (Next.js 15+)', () => {
      it('should recognize proxy at root', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('proxy.ts')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('proxy.tsx')).toBe(true)
      })

      it('should recognize proxy in src/', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('src/proxy.ts')).toBe(true)
      })

      it('should not recognize proxy in pages/', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/proxy.ts')).toBe(false)
      })
    })

    describe('regular files', () => {
      it('should not recognize files outside pages', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('components/Button.tsx')).toBe(false)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('lib/utils.ts')).toBe(false)
      })

      it('should not recognize non-js/ts files', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/styles.css')).toBe(false)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages/data.json')).toBe(false)
      })
    })

    describe('Windows paths', () => {
      it('should handle Windows backslash paths', () => {
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('pages\\index.tsx')).toBe(true)
        expect(nextjsPagesPlugin.isImplicitlyUsed?.('src\\pages\\_app.tsx')).toBe(true)
      })
    })
  })

  describe('shouldIgnore', () => {
    it('should ignore .next directory', () => {
      expect(nextjsPagesPlugin.shouldIgnore?.('.next/cache/file.js')).toBe(true)
    })

    it('should ignore out directory', () => {
      expect(nextjsPagesPlugin.shouldIgnore?.('out/index.html')).toBe(true)
    })

    it('should ignore next-env.d.ts', () => {
      expect(nextjsPagesPlugin.shouldIgnore?.('next-env.d.ts')).toBe(true)
    })

    it('should not ignore regular source files', () => {
      expect(nextjsPagesPlugin.shouldIgnore?.('pages/index.tsx')).toBe(false)
      expect(nextjsPagesPlugin.shouldIgnore?.('components/Button.tsx')).toBe(false)
    })
  })

  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(nextjsPagesPlugin.normalizePath?.('pages\\index.tsx')).toBe('pages/index.tsx')
    })

    it('should keep path intact (no route groups in pages router)', () => {
      expect(nextjsPagesPlugin.normalizePath?.('pages/users/[id].tsx')).toBe('pages/users/[id].tsx')
    })
  })
})
