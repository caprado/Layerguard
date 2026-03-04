/**
 * Vite + React plugin
 *
 * Handles Vite-specific conventions
 */

import type { FrameworkPlugin } from './types.js'

/**
 * Vite React plugin
 */
export const viteReactPlugin: FrameworkPlugin = {
  name: 'Vite + React',
  framework: 'vite-react',

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

    return false
  },

  shouldIgnore(filePath: string): boolean {
    const segments = filePath.split('/')

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

export default viteReactPlugin
