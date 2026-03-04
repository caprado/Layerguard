/**
 * Node.js Backend plugin
 *
 * Handles conventions for Express, Fastify, Koa, and other Node.js backends
 */

import type { FrameworkPlugin } from './types.js'

/**
 * Common entry points for Node.js backends
 */
const ENTRY_POINT_PATTERNS = [
  /^(src\/)?index\.(ts|js|mjs|cjs)$/,
  /^(src\/)?main\.(ts|js|mjs|cjs)$/,
  /^(src\/)?server\.(ts|js|mjs|cjs)$/,
  /^(src\/)?app\.(ts|js|mjs|cjs)$/,
]

/**
 * Common directories that contain implicitly used files
 */
const IMPLICIT_DIRECTORIES = [
  'routes',
  'controllers',
  'middleware',
  'middlewares',
  'handlers',
]

/**
 * Node.js Backend plugin
 */
export const nodeBackendPlugin: FrameworkPlugin = {
  name: 'Node.js Backend',
  framework: 'node-backend',

  defaultIgnorePatterns: [
    'dist/**',
    'build/**',
    'node_modules/**',
    'coverage/**',
    '.nyc_output/**',
  ],

  isImplicitlyUsed(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')

    // Entry point files
    for (const pattern of ENTRY_POINT_PATTERNS) {
      if (pattern.test(normalized)) {
        return true
      }
    }

    // Configuration files
    if (
      normalized === 'package.json' ||
      normalized === 'tsconfig.json' ||
      normalized.endsWith('.config.ts') ||
      normalized.endsWith('.config.js') ||
      normalized.endsWith('.config.mjs')
    ) {
      return true
    }

    // Files in routes/controllers/middleware directories are often
    // loaded dynamically or through auto-registration
    const segments = normalized.split('/')
    for (const dir of IMPLICIT_DIRECTORIES) {
      if (segments.includes(dir)) {
        return true
      }
    }

    // Migration files are implicitly used
    if (
      normalized.includes('/migrations/') ||
      normalized.includes('/seeds/')
    ) {
      return true
    }

    return false
  },

  shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    const segments = normalized.split('/')

    // Ignore dist/build directories
    if (segments[0] === 'dist' || segments[0] === 'build') return true

    // Ignore coverage
    if (segments[0] === 'coverage' || segments[0] === '.nyc_output') return true

    return false
  },

  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/')
  },
}

export default nodeBackendPlugin
