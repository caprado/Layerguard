/**
 * Vite + React Router plugin
 *
 * Handles Vite-specific conventions with file-based routing support
 * for React Router (using the file-based routing convention)
 */

import type { FrameworkPlugin } from './types.js'

/**
 * Route file patterns for React Router file-based routing
 */
const ROUTE_FILE_PATTERNS = [
  // Route files in routes/ directory
  /^src\/routes\/.*\.(tsx?|jsx?)$/,
  // Route files in pages/ directory (alternative convention)
  /^src\/pages\/.*\.(tsx?|jsx?)$/,
]

/**
 * Vite + React Router plugin
 */
export const viteReactRouterPlugin: FrameworkPlugin = {
  name: 'Vite + React Router',
  framework: 'vite-react-router',

  defaultIgnorePatterns: [
    'dist/**',
    '.vite/**',
    'vite.config.ts.timestamp-*',
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

    // Root route file
    if (
      normalized === 'src/root.tsx' ||
      normalized === 'src/root.jsx'
    ) {
      return true
    }

    // Router configuration
    if (
      normalized === 'src/router.tsx' ||
      normalized === 'src/router.ts' ||
      normalized === 'src/routes.tsx' ||
      normalized === 'src/routes.ts'
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

    return false
  },

  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/')
  },
}

export default viteReactRouterPlugin
