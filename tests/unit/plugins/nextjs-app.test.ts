/**
 * Tests for Next.js App Router plugin
 */

import { describe, it, expect } from 'vitest'
import { nextjsAppPlugin } from '../../../src/plugins/nextjs-app.js'

describe('nextjsAppPlugin', () => {
  describe('metadata', () => {
    it('should have correct name and framework', () => {
      expect(nextjsAppPlugin.name).toBe('Next.js App Router')
      expect(nextjsAppPlugin.framework).toBe('nextjs-app')
    })

    it('should have default ignore patterns', () => {
      expect(nextjsAppPlugin.defaultIgnorePatterns).toContain('.next/**')
      expect(nextjsAppPlugin.defaultIgnorePatterns).toContain('out/**')
      expect(nextjsAppPlugin.defaultIgnorePatterns).toContain('next-env.d.ts')
    })
  })

  describe('isImplicitlyUsed', () => {
    describe('page files', () => {
      it('should recognize page.tsx in app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/page.tsx')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/page.ts')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/page.jsx')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/page.js')).toBe(true)
      })

      it('should recognize page.tsx in nested app routes', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/dashboard/page.tsx')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/users/[id]/page.tsx')).toBe(true)
      })

      it('should recognize page.tsx in src/app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('src/app/page.tsx')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('src/app/dashboard/page.tsx')).toBe(true)
      })

      it('should not recognize page.tsx outside app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('components/page.tsx')).toBe(false)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('lib/page.tsx')).toBe(false)
      })
    })

    describe('layout files', () => {
      it('should recognize layout.tsx in app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/layout.tsx')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/dashboard/layout.tsx')).toBe(true)
      })

      it('should recognize layout.tsx in src/app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('src/app/layout.tsx')).toBe(true)
      })
    })

    describe('loading files', () => {
      it('should recognize loading.tsx in app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/loading.tsx')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/dashboard/loading.tsx')).toBe(true)
      })
    })

    describe('error files', () => {
      it('should recognize error.tsx in app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/error.tsx')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/global-error.tsx')).toBe(true)
      })
    })

    describe('not-found files', () => {
      it('should recognize not-found.tsx in app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/not-found.tsx')).toBe(true)
      })
    })

    describe('template files', () => {
      it('should recognize template.tsx in app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/template.tsx')).toBe(true)
      })
    })

    describe('route handlers', () => {
      it('should recognize route.ts in app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/api/route.ts')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/api/users/route.ts')).toBe(true)
      })
    })

    describe('middleware', () => {
      it('should recognize middleware.ts at root', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('middleware.ts')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('middleware.tsx')).toBe(true)
      })

      it('should recognize middleware.ts in src/', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('src/middleware.ts')).toBe(true)
      })

      it('should not recognize middleware.ts in nested directories', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/middleware.ts')).toBe(false)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('lib/middleware.ts')).toBe(false)
      })
    })

    describe('proxy (Next.js 15+)', () => {
      it('should recognize proxy.ts at root', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('proxy.ts')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('proxy.tsx')).toBe(true)
      })

      it('should recognize proxy.ts in src/', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('src/proxy.ts')).toBe(true)
      })

      it('should not recognize proxy.ts in nested directories', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/proxy.ts')).toBe(false)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('lib/proxy.ts')).toBe(false)
      })
    })

    describe('instrumentation', () => {
      it('should recognize instrumentation.ts at root', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('instrumentation.ts')).toBe(true)
      })

      it('should recognize instrumentation.ts in src/', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('src/instrumentation.ts')).toBe(true)
      })
    })

    describe('metadata files', () => {
      it('should recognize opengraph-image.tsx', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/opengraph-image.tsx')).toBe(true)
      })

      it('should recognize sitemap.tsx', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/sitemap.ts')).toBe(true)
      })

      it('should recognize robots.tsx', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/robots.ts')).toBe(true)
      })
    })

    describe('parallel routes (default.tsx)', () => {
      it('should recognize default.tsx in app directory', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/@modal/default.tsx')).toBe(true)
      })
    })

    describe('regular files', () => {
      it('should not recognize regular component files', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app/components/Button.tsx')).toBe(false)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('src/lib/utils.ts')).toBe(false)
      })
    })

    describe('Windows paths', () => {
      it('should handle Windows backslash paths', () => {
        expect(nextjsAppPlugin.isImplicitlyUsed?.('app\\page.tsx')).toBe(true)
        expect(nextjsAppPlugin.isImplicitlyUsed?.('src\\app\\layout.tsx')).toBe(true)
      })
    })
  })

  describe('shouldIgnore', () => {
    it('should ignore .next directory', () => {
      expect(nextjsAppPlugin.shouldIgnore?.('.next/cache/file.js')).toBe(true)
      expect(nextjsAppPlugin.shouldIgnore?.('.next/server/app/page.js')).toBe(true)
    })

    it('should ignore out directory', () => {
      expect(nextjsAppPlugin.shouldIgnore?.('out/index.html')).toBe(true)
    })

    it('should ignore next-env.d.ts', () => {
      expect(nextjsAppPlugin.shouldIgnore?.('next-env.d.ts')).toBe(true)
    })

    it('should not ignore regular source files', () => {
      expect(nextjsAppPlugin.shouldIgnore?.('app/page.tsx')).toBe(false)
      expect(nextjsAppPlugin.shouldIgnore?.('src/lib/utils.ts')).toBe(false)
    })
  })

  describe('isRouteGroup', () => {
    it('should recognize route groups', () => {
      expect(nextjsAppPlugin.isRouteGroup?.('(auth)')).toBe(true)
      expect(nextjsAppPlugin.isRouteGroup?.('(marketing)')).toBe(true)
      expect(nextjsAppPlugin.isRouteGroup?.('(admin-panel)')).toBe(true)
    })

    it('should not recognize regular directories', () => {
      expect(nextjsAppPlugin.isRouteGroup?.('auth')).toBe(false)
      expect(nextjsAppPlugin.isRouteGroup?.('dashboard')).toBe(false)
      expect(nextjsAppPlugin.isRouteGroup?.('[id]')).toBe(false)
    })
  })

  describe('normalizePath', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(nextjsAppPlugin.normalizePath?.('app\\page.tsx')).toBe('app/page.tsx')
    })

    it('should remove route groups from path', () => {
      expect(nextjsAppPlugin.normalizePath?.('app/(auth)/login/page.tsx')).toBe('app/login/page.tsx')
      expect(nextjsAppPlugin.normalizePath?.('app/(marketing)/(home)/page.tsx')).toBe('app/page.tsx')
    })

    it('should preserve non-route-group directories', () => {
      expect(nextjsAppPlugin.normalizePath?.('app/dashboard/[id]/page.tsx')).toBe('app/dashboard/[id]/page.tsx')
    })
  })
})
