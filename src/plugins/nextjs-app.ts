/**
 * Next.js App Router plugin
 *
 * Handles special files and conventions for Next.js 13+ App Router
 */

import type { FrameworkPlugin } from './types.js'

/**
 * Special file names in Next.js App Router
 * These files are implicitly used by the framework via filesystem routing
 */
const SPECIAL_FILES = new Set([
  // Page files
  'page.tsx',
  'page.ts',
  'page.jsx',
  'page.js',

  // Layout files
  'layout.tsx',
  'layout.ts',
  'layout.jsx',
  'layout.js',

  // Loading files
  'loading.tsx',
  'loading.ts',
  'loading.jsx',
  'loading.js',

  // Error files
  'error.tsx',
  'error.ts',
  'error.jsx',
  'error.js',

  // Not found files
  'not-found.tsx',
  'not-found.ts',
  'not-found.jsx',
  'not-found.js',

  // Template files
  'template.tsx',
  'template.ts',
  'template.jsx',
  'template.js',

  // Default files (for parallel routes)
  'default.tsx',
  'default.ts',
  'default.jsx',
  'default.js',

  // Route handlers
  'route.tsx',
  'route.ts',
  'route.jsx',
  'route.js',

  // Global error
  'global-error.tsx',
  'global-error.ts',
  'global-error.jsx',
  'global-error.js',

  // Middleware (legacy)
  'middleware.tsx',
  'middleware.ts',
  'middleware.jsx',
  'middleware.js',

  // Proxy (Next.js 15+, replaces middleware)
  'proxy.tsx',
  'proxy.ts',
  'proxy.jsx',
  'proxy.js',

  // Instrumentation
  'instrumentation.tsx',
  'instrumentation.ts',
  'instrumentation.jsx',
  'instrumentation.js',

  // Opengraph image
  'opengraph-image.tsx',
  'opengraph-image.ts',
  'opengraph-image.jsx',
  'opengraph-image.js',

  // Twitter image
  'twitter-image.tsx',
  'twitter-image.ts',
  'twitter-image.jsx',
  'twitter-image.js',

  // Sitemap
  'sitemap.tsx',
  'sitemap.ts',
  'sitemap.jsx',
  'sitemap.js',

  // Robots
  'robots.tsx',
  'robots.ts',
  'robots.jsx',
  'robots.js',

  // Icon
  'icon.tsx',
  'icon.ts',
  'icon.jsx',
  'icon.js',

  // Apple icon
  'apple-icon.tsx',
  'apple-icon.ts',
  'apple-icon.jsx',
  'apple-icon.js',
])

/**
 * Root-level special files (must be at project root or src/)
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
  // Instrumentation
  'instrumentation.tsx',
  'instrumentation.ts',
  'instrumentation.jsx',
  'instrumentation.js',
])

/**
 * Patterns for route groups: (groupName)
 */
const ROUTE_GROUP_PATTERN = /^\([^)]+\)$/

/**
 * Next.js App Router plugin
 */
export const nextjsAppPlugin: FrameworkPlugin = {
  name: 'Next.js App Router',
  framework: 'nextjs-app',

  defaultIgnorePatterns: [
    '.next/**',
    'out/**',
    'next-env.d.ts',
  ],

  isImplicitlyUsed(filePath: string): boolean {
    const normalized = normalizePath(filePath)
    const segments = normalized.split('/')
    const fileName = segments[segments.length - 1]

    if (!fileName) return false

    // Check if it's a special file name
    if (SPECIAL_FILES.has(fileName)) {
      // Root-level files like middleware.ts must be at root or src/
      if (ROOT_SPECIAL_FILES.has(fileName)) {
        return (
          segments.length === 1 ||
          (segments.length === 2 && segments[0] === 'src')
        )
      }

      // Other special files must be in app/ or src/app/
      const isInApp =
        segments[0] === 'app' ||
        (segments[0] === 'src' && segments[1] === 'app')

      return isInApp
    }

    return false
  },

  shouldIgnore(filePath: string): boolean {
    const segments = filePath.split('/')

    // Ignore .next directory
    if (segments[0] === '.next') return true

    // Ignore out directory (static export)
    if (segments[0] === 'out') return true

    // Ignore next-env.d.ts
    if (filePath === 'next-env.d.ts') return true

    return false
  },

  isRouteGroup(segment: string): boolean {
    return ROUTE_GROUP_PATTERN.test(segment)
  },

  normalizePath(filePath: string): string {
    return normalizePath(filePath)
  },
}

/**
 * Normalize a file path by removing route groups
 */
function normalizePath(filePath: string): string {
  // Normalize backslashes to forward slashes
  const normalized = filePath.replace(/\\/g, '/')

  // Remove route groups from path
  const segments = normalized.split('/')
  const filteredSegments = segments.filter(
    (segment) => !ROUTE_GROUP_PATTERN.test(segment)
  )

  return filteredSegments.join('/')
}

export default nextjsAppPlugin
