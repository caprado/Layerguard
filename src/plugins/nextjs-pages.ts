/**
 * Next.js Pages Router plugin
 *
 * Handles special files and conventions for Next.js Pages Router
 */

import type { FrameworkPlugin } from './types.js'

/**
 * Special file names in Next.js Pages Router
 * These files are implicitly used by the framework
 */
const SPECIAL_FILES = new Set([
  // Custom App
  '_app.tsx',
  '_app.ts',
  '_app.jsx',
  '_app.js',

  // Custom Document
  '_document.tsx',
  '_document.ts',
  '_document.jsx',
  '_document.js',

  // Custom Error
  '_error.tsx',
  '_error.ts',
  '_error.jsx',
  '_error.js',

  // 404 page
  '404.tsx',
  '404.ts',
  '404.jsx',
  '404.js',

  // 500 page
  '500.tsx',
  '500.ts',
  '500.jsx',
  '500.js',

  // Middleware (Next.js 12+, legacy)
  'middleware.tsx',
  'middleware.ts',
  'middleware.jsx',
  'middleware.js',

  // Proxy (Next.js 15+, replaces middleware)
  'proxy.tsx',
  'proxy.ts',
  'proxy.jsx',
  'proxy.js',
])

/**
 * Root-level special files
 */
const ROOT_SPECIAL_FILES = new Set([
  // Middleware (legacy)
  'middleware.tsx',
  'middleware.ts',
  'middleware.jsx',
  'middleware.js',
  // Proxy (Next.js 15+)
  'proxy.tsx',
  'proxy.ts',
  'proxy.jsx',
  'proxy.js',
])

/**
 * Next.js Pages Router plugin
 */
export const nextjsPagesPlugin: FrameworkPlugin = {
  name: 'Next.js Pages Router',
  framework: 'nextjs-pages',

  defaultIgnorePatterns: [
    '.next/**',
    'out/**',
    'next-env.d.ts',
  ],

  isImplicitlyUsed(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    const segments = normalized.split('/')
    const fileName = segments[segments.length - 1]

    if (!fileName) return false

    // Check root-level special files
    if (ROOT_SPECIAL_FILES.has(fileName)) {
      return (
        segments.length === 1 ||
        (segments.length === 2 && segments[0] === 'src')
      )
    }

    // Check if in pages/ directory
    const isInPages =
      segments[0] === 'pages' ||
      (segments[0] === 'src' && segments[1] === 'pages')

    if (!isInPages) return false

    // Special files in pages/
    if (SPECIAL_FILES.has(fileName)) {
      return true
    }

    // Any file in pages/ is a route (including index files)
    const ext = getExtension(fileName)
    if (['.tsx', '.ts', '.jsx', '.js'].includes(ext)) {
      return true
    }

    return false
  },

  shouldIgnore(filePath: string): boolean {
    const segments = filePath.split('/')

    // Ignore .next directory
    if (segments[0] === '.next') return true

    // Ignore out directory
    if (segments[0] === 'out') return true

    // Ignore next-env.d.ts
    if (filePath === 'next-env.d.ts') return true

    return false
  },

  normalizePath(filePath: string): string {
    // Pages router doesn't have route groups
    return filePath.replace(/\\/g, '/')
  },
}

/**
 * Get file extension
 */
function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  return lastDot >= 0 ? fileName.slice(lastDot) : ''
}

export default nextjsPagesPlugin
