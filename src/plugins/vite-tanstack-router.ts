/**
 * Vite + TanStack Router plugin
 *
 * Handles Vite-specific conventions with TanStack Router's file-based routing
 */

import type { FrameworkPlugin } from './types.js'

/**
 * Route file patterns for TanStack Router file-based routing
 */
const ROUTE_FILE_PATTERNS = [
  // Route files in routes/ directory
  /^src\/routes\/.*\.(tsx?|jsx?)$/,
  // Lazy route files
  /^src\/routes\/.*\.lazy\.(tsx?|jsx?)$/,
]

/**
 * Generated files that should be ignored
 */
const GENERATED_FILE_PATTERNS = [
  // Auto-generated route tree
  /routeTree\.gen\.(ts|tsx|js|jsx)$/,
  // Route manifest
  /route-manifest\.json$/,
]

/**
 * Vite + TanStack Router plugin
 */
export const viteTanstackRouterPlugin: FrameworkPlugin = {
  name: 'Vite + TanStack Router',
  framework: 'vite-tanstack-router',

  defaultIgnorePatterns: [
    'dist/**',
    '.vite/**',
    'vite.config.ts.timestamp-*',
    '**/routeTree.gen.ts',
    '**/routeTree.gen.tsx',
  ],

  isImplicitlyUsed(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')

    // main.tsx/main.jsx is the entry point
    if (
      normalized === 'src/main.tsx' ||
      normalized === 'src/main.jsx' ||
      normalized === 'src/main.ts' ||
      normalized === 'src/main.js'
    ) {
      return true
    }

    // index.html references entry point
    if (normalized === 'index.html') {
      return true
    }

    // vite.config.ts/js
    if (
      normalized === 'vite.config.ts' ||
      normalized === 'vite.config.js' ||
      normalized === 'vite.config.mjs'
    ) {
      return true
    }

    // Route files are implicitly used by the router
    for (const pattern of ROUTE_FILE_PATTERNS) {
      if (pattern.test(normalized)) {
        return true
      }
    }

    // Generated route tree is implicitly used
    for (const pattern of GENERATED_FILE_PATTERNS) {
      if (pattern.test(normalized)) {
        return true
      }
    }

    // Router configuration
    if (
      normalized === 'src/router.tsx' ||
      normalized === 'src/router.ts'
    ) {
      return true
    }

    // Root route
    if (
      normalized === 'src/routes/__root.tsx' ||
      normalized === 'src/routes/__root.jsx'
    ) {
      return true
    }

    return false
  },

  shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    const segments = normalized.split('/')

    // Ignore dist directory
    if (segments[0] === 'dist') return true

    // Ignore .vite cache
    if (segments[0] === '.vite') return true

    // Ignore generated route tree files
    for (const pattern of GENERATED_FILE_PATTERNS) {
      if (pattern.test(normalized)) {
        return true
      }
    }

    return false
  },

  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/')
  },
}

export default viteTanstackRouterPlugin
