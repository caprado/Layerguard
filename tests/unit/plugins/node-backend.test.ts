/**
 * Tests for Node.js Backend plugin
 */

import { describe, it, expect } from 'vitest'
import { nodeBackendPlugin } from '../../../src/plugins/node-backend.js'

describe('nodeBackendPlugin', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      expect(nodeBackendPlugin.name).toBe('Node.js Backend')
    })

    it('has correct framework identifier', () => {
      expect(nodeBackendPlugin.framework).toBe('node-backend')
    })

    it('has default ignore patterns', () => {
      expect(nodeBackendPlugin.defaultIgnorePatterns).toContain('dist/**')
      expect(nodeBackendPlugin.defaultIgnorePatterns).toContain('build/**')
      expect(nodeBackendPlugin.defaultIgnorePatterns).toContain('node_modules/**')
      expect(nodeBackendPlugin.defaultIgnorePatterns).toContain('coverage/**')
    })
  })

  describe('isImplicitlyUsed', () => {
    it('returns true for entry points', () => {
      expect(nodeBackendPlugin.isImplicitlyUsed?.('index.ts')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('index.js')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/index.ts')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/main.ts')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/server.ts')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/app.ts')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('server.mjs')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('app.cjs')).toBe(true)
    })

    it('returns true for configuration files', () => {
      expect(nodeBackendPlugin.isImplicitlyUsed?.('package.json')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('tsconfig.json')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('jest.config.ts')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('vitest.config.js')).toBe(true)
    })

    it('returns true for files in routes directory', () => {
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/routes/users.ts')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('routes/api/v1/users.ts')).toBe(true)
    })

    it('returns true for files in controllers directory', () => {
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/controllers/UserController.ts')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('controllers/auth.ts')).toBe(true)
    })

    it('returns true for files in middleware directory', () => {
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/middleware/auth.ts')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('middlewares/logger.ts')).toBe(true)
    })

    it('returns true for files in handlers directory', () => {
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/handlers/webhook.ts')).toBe(true)
    })

    it('returns true for migration files', () => {
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/migrations/001_create_users.ts')).toBe(true)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('db/migrations/20231001_init.ts')).toBe(true)
    })

    it('returns true for seed files', () => {
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/seeds/users.ts')).toBe(true)
    })

    it('returns false for regular service files', () => {
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/services/UserService.ts')).toBe(false)
      expect(nodeBackendPlugin.isImplicitlyUsed?.('src/utils/helpers.ts')).toBe(false)
    })
  })

  describe('shouldIgnore', () => {
    it('returns true for dist directory', () => {
      expect(nodeBackendPlugin.shouldIgnore?.('dist/index.js')).toBe(true)
    })

    it('returns true for build directory', () => {
      expect(nodeBackendPlugin.shouldIgnore?.('build/server.js')).toBe(true)
    })

    it('returns true for coverage directory', () => {
      expect(nodeBackendPlugin.shouldIgnore?.('coverage/lcov.info')).toBe(true)
      expect(nodeBackendPlugin.shouldIgnore?.('.nyc_output/report.json')).toBe(true)
    })

    it('returns false for source files', () => {
      expect(nodeBackendPlugin.shouldIgnore?.('src/app.ts')).toBe(false)
    })
  })

  describe('normalizePath', () => {
    it('converts backslashes to forward slashes', () => {
      expect(nodeBackendPlugin.normalizePath?.('src\\routes\\users.ts')).toBe('src/routes/users.ts')
    })
  })
})
