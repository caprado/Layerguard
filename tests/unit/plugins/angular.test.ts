/**
 * Tests for Angular plugin
 */

import { describe, it, expect } from 'vitest'
import { angularPlugin } from '../../../src/plugins/angular.js'

describe('angularPlugin', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      expect(angularPlugin.name).toBe('Angular')
    })

    it('has correct framework identifier', () => {
      expect(angularPlugin.framework).toBe('angular')
    })

    it('has default ignore patterns', () => {
      expect(angularPlugin.defaultIgnorePatterns).toContain('dist/**')
      expect(angularPlugin.defaultIgnorePatterns).toContain('.angular/**')
      expect(angularPlugin.defaultIgnorePatterns).toContain('**/*.spec.ts')
      expect(angularPlugin.defaultIgnorePatterns).toContain('e2e/**')
    })
  })

  describe('isImplicitlyUsed', () => {
    it('returns true for entry points', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/main.ts')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/main.js')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/polyfills.ts')).toBe(true)
    })

    it('returns true for Angular configuration files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('angular.json')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('.angular.json')).toBe(true)
    })

    it('returns true for index.html', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/index.html')).toBe(true)
    })

    it('returns true for app module and component', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/app.module.ts')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/app/app.component.ts')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/app/app.config.ts')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/app/app.routes.ts')).toBe(true)
    })

    it('returns true for environment files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/environments/environment.ts')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/environments/environment.prod.ts')).toBe(true)
    })

    it('returns true for component files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/users/user-list.component.ts')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/app/shared/button.component.ts')).toBe(true)
    })

    it('returns true for module files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/users/users.module.ts')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/app/core/core.module.ts')).toBe(true)
    })

    it('returns true for service files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/services/user.service.ts')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/app/core/auth.service.ts')).toBe(true)
    })

    it('returns true for guard files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/guards/auth.guard.ts')).toBe(true)
    })

    it('returns true for pipe files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/pipes/date-format.pipe.ts')).toBe(true)
    })

    it('returns true for directive files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/directives/highlight.directive.ts')).toBe(true)
    })

    it('returns true for interceptor files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/interceptors/auth.interceptor.ts')).toBe(true)
    })

    it('returns true for resolver files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/resolvers/user.resolver.ts')).toBe(true)
    })

    it('returns true for routing modules', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/app-routing.module.ts')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/app/users/users-routing.module.ts')).toBe(true)
    })

    it('returns true for assets', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/assets/logo.svg')).toBe(true)
    })

    it('returns true for global styles', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/styles.css')).toBe(true)
      expect(angularPlugin.isImplicitlyUsed?.('src/styles.scss')).toBe(true)
    })

    it('returns false for regular TypeScript files', () => {
      expect(angularPlugin.isImplicitlyUsed?.('src/app/utils/helpers.ts')).toBe(false)
      expect(angularPlugin.isImplicitlyUsed?.('src/app/models/user.ts')).toBe(false)
    })
  })

  describe('shouldIgnore', () => {
    it('returns true for dist directory', () => {
      expect(angularPlugin.shouldIgnore?.('dist/my-app/main.js')).toBe(true)
    })

    it('returns true for .angular cache', () => {
      expect(angularPlugin.shouldIgnore?.('.angular/cache/stats.json')).toBe(true)
    })

    it('returns true for e2e tests', () => {
      expect(angularPlugin.shouldIgnore?.('e2e/app.e2e-spec.ts')).toBe(true)
    })

    it('returns true for coverage', () => {
      expect(angularPlugin.shouldIgnore?.('coverage/lcov.info')).toBe(true)
    })

    it('returns true for spec files', () => {
      expect(angularPlugin.shouldIgnore?.('src/app/users/user.service.spec.ts')).toBe(true)
      expect(angularPlugin.shouldIgnore?.('src/app/app.component.spec.ts')).toBe(true)
    })

    it('returns false for source files', () => {
      expect(angularPlugin.shouldIgnore?.('src/app/app.component.ts')).toBe(false)
    })
  })

  describe('normalizePath', () => {
    it('converts backslashes to forward slashes', () => {
      expect(angularPlugin.normalizePath?.('src\\app\\users\\user.component.ts')).toBe('src/app/users/user.component.ts')
    })
  })
})
