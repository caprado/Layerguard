/**
 * Framework and project detection
 *
 * Detects the project type and framework to suggest presets
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Detected framework types
 */
export type DetectedFramework =
  | 'nextjs-app'
  | 'nextjs-pages'
  | 'vite-react'
  | 'angular'
  | 'vue'
  | 'node'
  | 'unknown'

/**
 * Detection result
 */
export interface DetectionResult {
  /**
   * The detected framework
   */
  framework: DetectedFramework

  /**
   * Whether a TypeScript project
   */
  isTypeScript: boolean

  /**
   * The project root
   */
  projectRoot: string

  /**
   * Details about the detection
   */
  details: string
}

/**
 * Common directory patterns to look for
 */
export const COMMON_LAYER_PATTERNS = [
  'app',
  'pages',
  'src',
  'components',
  'hooks',
  'utils',
  'lib',
  'services',
  'api',
  'types',
  'constants',
  'stores',
  'modules',
  'features',
  'shared',
  'common',
  'core',
  'models',
  'controllers',
  'routes',
  'middleware',
  'helpers',
] as const

/**
 * Detect the project framework
 */
export function detectFramework(projectRoot: string): DetectionResult {
  const result: DetectionResult = {
    framework: 'unknown',
    isTypeScript: false,
    projectRoot,
    details: '',
  }

  // Check for TypeScript
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
  result.isTypeScript = fs.existsSync(tsconfigPath)

  // Check for Next.js
  const nextConfigPatterns = [
    'next.config.ts',
    'next.config.js',
    'next.config.mjs',
  ]
  const hasNextConfig = nextConfigPatterns.some((p) =>
    fs.existsSync(path.join(projectRoot, p))
  )

  if (hasNextConfig) {
    // Determine if App Router or Pages Router
    const hasAppDir = fs.existsSync(path.join(projectRoot, 'app'))
    const hasSrcAppDir = fs.existsSync(path.join(projectRoot, 'src', 'app'))
    const hasPagesDir = fs.existsSync(path.join(projectRoot, 'pages'))
    const hasSrcPagesDir = fs.existsSync(path.join(projectRoot, 'src', 'pages'))

    if (hasAppDir || hasSrcAppDir) {
      result.framework = 'nextjs-app'
      result.details = 'Detected Next.js App Router'
    } else if (hasPagesDir || hasSrcPagesDir) {
      result.framework = 'nextjs-pages'
      result.details = 'Detected Next.js Pages Router'
    } else {
      result.framework = 'nextjs-app'
      result.details = 'Detected Next.js (assuming App Router)'
    }
    return result
  }

  // Check for Vite
  const viteConfigPatterns = [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
  ]
  const hasViteConfig = viteConfigPatterns.some((p) =>
    fs.existsSync(path.join(projectRoot, p))
  )

  if (hasViteConfig) {
    result.framework = 'vite-react'
    result.details = 'Detected Vite project'
    return result
  }

  // Check for Angular
  const angularJsonPath = path.join(projectRoot, 'angular.json')
  if (fs.existsSync(angularJsonPath)) {
    result.framework = 'angular'
    result.details = 'Detected Angular project'
    return result
  }

  // Check for Vue/Nuxt
  const nuxtConfigPatterns = ['nuxt.config.ts', 'nuxt.config.js']
  const hasNuxtConfig = nuxtConfigPatterns.some((p) =>
    fs.existsSync(path.join(projectRoot, p))
  )

  if (hasNuxtConfig) {
    result.framework = 'vue'
    result.details = 'Detected Nuxt.js project'
    return result
  }

  // Check package.json for framework hints
  const packageJsonPath = path.join(projectRoot, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }

      if (deps.next) {
        // Next.js in package.json but no config file
        const hasAppDir = fs.existsSync(path.join(projectRoot, 'app'))
        const hasSrcAppDir = fs.existsSync(path.join(projectRoot, 'src', 'app'))
        if (hasAppDir || hasSrcAppDir) {
          result.framework = 'nextjs-app'
          result.details = 'Detected Next.js App Router (from package.json)'
        } else {
          result.framework = 'nextjs-pages'
          result.details = 'Detected Next.js Pages Router (from package.json)'
        }
        return result
      }

      if (deps.vue || deps.nuxt) {
        result.framework = 'vue'
        result.details = 'Detected Vue project (from package.json)'
        return result
      }

      if (deps['@angular/core']) {
        result.framework = 'angular'
        result.details = 'Detected Angular project (from package.json)'
        return result
      }

      if (deps.express || deps.fastify || deps.koa) {
        result.framework = 'node'
        result.details = 'Detected Node.js backend project'
        return result
      }
    } catch {
      // Ignore parse errors
    }
  }

  result.details = 'No specific framework detected'
  return result
}

/**
 * Directory info for layer candidate
 */
export interface DirectoryInfo {
  /**
   * Directory name (e.g., "components")
   */
  name: string

  /**
   * Relative path from project root
   */
  path: string

  /**
   * Subdirectories (for potential sublayers)
   */
  subdirs: string[]

  /**
   * Whether this is a common layer pattern
   */
  isCommon: boolean

  /**
   * Number of source files in this directory (recursive)
   */
  fileCount: number
}

/**
 * Scan a directory for layer candidates
 */
export function scanForLayers(
  projectRoot: string,
  maxDepth: number = 2
): DirectoryInfo[] {
  const results: DirectoryInfo[] = []
  const ignoreDirs = new Set([
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'coverage',
    '__tests__',
    '__mocks__',
    '.turbo',
    '.cache',
  ])

  function walk(dir: string, depth: number, basePath: string): void {
    if (depth > maxDepth) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('.')) continue
      if (ignoreDirs.has(entry.name)) continue

      const fullPath = path.join(dir, entry.name)
      const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name
      const isCommon = COMMON_LAYER_PATTERNS.includes(
        entry.name as (typeof COMMON_LAYER_PATTERNS)[number]
      )

      // Get subdirectories
      let subdirs: string[] = []
      try {
        subdirs = fs
          .readdirSync(fullPath, { withFileTypes: true })
          .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
          .filter((e) => !ignoreDirs.has(e.name))
          .map((e) => e.name)
      } catch {
        // Ignore
      }

      // Count source files
      const fileCount = countSourceFiles(fullPath)

      // Only include directories that have source files or common patterns
      if (fileCount > 0 || isCommon) {
        results.push({
          name: entry.name,
          path: relativePath,
          subdirs,
          isCommon,
          fileCount,
        })
      }

      // Recurse into src/ directory
      if (entry.name === 'src' && depth < maxDepth) {
        walk(fullPath, depth + 1, relativePath)
      }
    }
  }

  walk(projectRoot, 0, '')
  return results.sort((a, b) => {
    // Sort common patterns first, then by file count
    if (a.isCommon && !b.isCommon) return -1
    if (!a.isCommon && b.isCommon) return 1
    return b.fileCount - a.fileCount
  })
}

/**
 * Count source files in a directory recursively
 */
function countSourceFiles(dir: string): number {
  let count = 0
  const extensions = new Set(['.ts', '.tsx', '.js', '.jsx'])
  const ignoreDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build'])

  function walk(d: string): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          walk(path.join(d, entry.name))
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if (extensions.has(ext)) {
          count++
        }
      }
    }
  }

  walk(dir)
  return count
}

/**
 * Get suggested flow rules based on detected layers
 */
export function suggestFlowRules(layers: string[]): string[] {
  const rules: string[] = []
  const layerSet = new Set(layers)

  // Common flow patterns
  const flowPatterns: Array<[string, string]> = [
    ['app', 'pages'],
    ['pages', 'components'],
    ['app', 'components'],
    ['components', 'hooks'],
    ['components', 'utils'],
    ['components', 'lib'],
    ['components', 'services'],
    ['hooks', 'api'],
    ['hooks', 'utils'],
    ['hooks', 'lib'],
    ['hooks', 'services'],
    ['api', 'utils'],
    ['api', 'lib'],
    ['services', 'utils'],
    ['services', 'lib'],
    ['services', 'models'],
    ['utils', 'types'],
    ['lib', 'types'],
    ['controllers', 'services'],
    ['controllers', 'models'],
    ['services', 'models'],
    ['routes', 'controllers'],
    ['middleware', 'utils'],
  ]

  // Bidirectional patterns
  const bidiPatterns: Array<[string, string]> = [
    ['hooks', 'stores'],
    ['api', 'stores'],
  ]

  for (const [from, to] of flowPatterns) {
    if (layerSet.has(from) && layerSet.has(to)) {
      rules.push(`${from} -> ${to}`)
    }
  }

  for (const [a, b] of bidiPatterns) {
    if (layerSet.has(a) && layerSet.has(b)) {
      rules.push(`${a} <-> ${b}`)
    }
  }

  return rules
}

/**
 * Check if a directory should be marked as isolated (features)
 */
export function shouldBeIsolated(dirName: string): boolean {
  const isolatedPatterns = ['features', 'modules', 'domains']
  return isolatedPatterns.includes(dirName.toLowerCase())
}
