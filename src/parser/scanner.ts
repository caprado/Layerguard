/**
 * File scanner - walks directories and collects source files
 */

import { readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

/**
 * Default patterns to ignore during file discovery
 */
export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.next',
  '.nuxt',
  '.output',
  'dist',
  'build',
  'out',
  'coverage',
  '__tests__',
  '__mocks__',
  '.git',
  '.svn',
]

/**
 * File extensions to include
 */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs'])

/**
 * Patterns that match test files
 */
const TEST_FILE_PATTERNS = ['.test.', '.spec.', '-test.', '-spec.']

/**
 * Patterns that match declaration files
 */
const DECLARATION_PATTERNS = ['.d.ts', '.d.mts', '.d.cts']

export interface ScanOptions {
  /**
   * Root directory to scan
   */
  root: string

  /**
   * Additional patterns to ignore (globs)
   */
  ignore?: string[]

  /**
   * Whether to include test files
   * @default false
   */
  includeTests?: boolean

  /**
   * Whether to include declaration files (.d.ts)
   * @default false
   */
  includeDeclarations?: boolean
}

export interface ScanResult {
  /**
   * All discovered source files (absolute paths)
   */
  files: string[]

  /**
   * Files that were skipped due to ignore patterns
   */
  skipped: string[]

  /**
   * Directories that were skipped
   */
  skippedDirs: string[]
}

/**
 * Check if a filename matches any of the given patterns
 */
function matchesPattern(filename: string, patterns: string[]): boolean {
  const lowerFilename = filename.toLowerCase()
  return patterns.some((pattern) => {
    // Handle glob patterns with *
    if (pattern.includes('*')) {
      const regex = globToRegex(pattern)
      return regex.test(lowerFilename)
    }
    // Simple substring match
    return lowerFilename.includes(pattern.toLowerCase())
  })
}

/**
 * Convert a simple glob pattern to a regex
 * Supports: * (any chars), ** (any path), ? (single char)
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*\*/g, '{{GLOBSTAR}}') // Temp placeholder for **
    .replace(/\*/g, '[^/\\\\]*') // * matches anything except path separators
    .replace(/\?/g, '.') // ? matches single char
    .replace(/\{\{GLOBSTAR\}\}/g, '.*') // ** matches anything including separators

  return new RegExp(`^${escaped}$`, 'i')
}

/**
 * Check if a path should be ignored based on patterns
 */
function shouldIgnore(
  relativePath: string,
  filename: string,
  ignorePatterns: string[]
): boolean {
  // Check directory/file name against default ignores
  if (DEFAULT_IGNORE_PATTERNS.includes(filename)) {
    return true
  }

  // Check against custom ignore patterns
  for (const pattern of ignorePatterns) {
    if (pattern.includes('/') || pattern.includes('\\')) {
      // Path pattern - match against full relative path
      const regex = globToRegex(pattern)
      if (regex.test(relativePath) || regex.test(relativePath.replace(/\\/g, '/'))) {
        return true
      }
    } else {
      // Simple pattern - match against filename
      if (matchesPattern(filename, [pattern])) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if a file is a test file
 */
function isTestFile(filename: string): boolean {
  return TEST_FILE_PATTERNS.some((pattern) => filename.includes(pattern))
}

/**
 * Check if a file is a declaration file
 */
function isDeclarationFile(filename: string): boolean {
  return DECLARATION_PATTERNS.some((pattern) => filename.endsWith(pattern))
}

/**
 * Check if a file is a source file we care about
 */
function isSourceFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase()
  return SOURCE_EXTENSIONS.has(ext)
}

/**
 * Scan a directory recursively for source files
 */
export function scanDirectory(options: ScanOptions): ScanResult {
  const { root, ignore = [], includeTests = false, includeDeclarations = false } = options

  const files: string[] = []
  const skipped: string[] = []
  const skippedDirs: string[] = []

  function walk(dir: string): void {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      // Directory not readable, skip
      return
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const relativePath = relative(root, fullPath)

      let stats
      try {
        stats = statSync(fullPath)
      } catch {
        // Can't stat, skip
        continue
      }

      if (stats.isDirectory()) {
        // Check if directory should be ignored
        if (shouldIgnore(relativePath, entry, ignore)) {
          skippedDirs.push(fullPath)
          continue
        }
        // Recurse into directory
        walk(fullPath)
      } else if (stats.isFile()) {
        // Check if it's a source file
        if (!isSourceFile(entry)) {
          continue
        }

        // Check if file should be ignored
        if (shouldIgnore(relativePath, entry, ignore)) {
          skipped.push(fullPath)
          continue
        }

        // Check test files
        if (!includeTests && isTestFile(entry)) {
          skipped.push(fullPath)
          continue
        }

        // Check declaration files
        if (!includeDeclarations && isDeclarationFile(entry)) {
          skipped.push(fullPath)
          continue
        }

        files.push(fullPath)
      }
    }
  }

  walk(root)

  return { files, skipped, skippedDirs }
}

/**
 * Get relative path from root, normalized with forward slashes
 */
export function getRelativePath(root: string, filePath: string): string {
  return relative(root, filePath).replace(/\\/g, '/')
}
