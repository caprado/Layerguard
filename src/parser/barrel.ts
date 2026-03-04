/**
 * Barrel file tracer - traces re-exports to their origin files
 *
 * Used for origin-mode barrel resolution where we need to know
 * the actual source file of a re-exported symbol.
 */

import ts from 'typescript'
import { readFileSync, existsSync } from 'node:fs'
import { resolveImport, type ResolverContext } from './resolver.js'

/**
 * Information about a re-export in a file
 */
export interface ReexportInfo {
  /**
   * The module specifier being re-exported from
   */
  specifier: string

  /**
   * Named exports being re-exported (empty array for `export * from`)
   */
  namedExports: string[]

  /**
   * Whether this is a wildcard re-export (`export * from`)
   */
  isWildcard: boolean

  /**
   * Whether this is a type-only re-export
   */
  isTypeOnly: boolean
}

/**
 * Result of analyzing a barrel file
 */
export interface BarrelAnalysis {
  /**
   * All re-exports found in the file
   */
  reexports: ReexportInfo[]

  /**
   * Whether this file has any re-exports (is a barrel)
   */
  isBarrel: boolean
}

/**
 * Cache for barrel analysis results
 */
const barrelCache = new Map<string, BarrelAnalysis>()

/**
 * Cache for origin resolution results
 */
const originCache = new Map<string, Map<string, string>>()

/**
 * Analyze a file for re-exports
 */
export function analyzeBarrel(filePath: string): BarrelAnalysis {
  // Check cache
  const cached = barrelCache.get(filePath)
  if (cached) {
    return cached
  }

  const reexports: ReexportInfo[] = []

  // Read and parse the file
  let sourceText: string
  try {
    sourceText = readFileSync(filePath, 'utf-8')
  } catch {
    const result = { reexports: [], isBarrel: false }
    barrelCache.set(filePath, result)
    return result
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  )

  // Walk the AST looking for export declarations with module specifiers
  function visit(node: ts.Node): void {
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const specifier = ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : null

      if (specifier) {
        const namedExports: string[] = []
        let isWildcard = false

        if (node.exportClause) {
          if (ts.isNamedExports(node.exportClause)) {
            // export { a, b } from './module'
            for (const element of node.exportClause.elements) {
              namedExports.push(element.name.text)
            }
          } else if (ts.isNamespaceExport(node.exportClause)) {
            // export * as ns from './module'
            namedExports.push(node.exportClause.name.text)
          }
        } else {
          // export * from './module'
          isWildcard = true
        }

        reexports.push({
          specifier,
          namedExports,
          isWildcard,
          isTypeOnly: node.isTypeOnly,
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  const result = {
    reexports,
    isBarrel: reexports.length > 0,
  }

  barrelCache.set(filePath, result)
  return result
}

/**
 * Trace a file's re-exports to find origin files.
 * Returns a map of resolved specifier -> origin file path.
 *
 * For example, if services/index.ts re-exports from repository/users.ts,
 * and you call traceOrigins('services/index.ts'), you'll get a mapping
 * showing that the re-export resolves to repository/users.ts.
 */
export function traceOrigins(
  filePath: string,
  context: ResolverContext,
  maxDepth: number = 10
): Map<string, string> {
  // Check cache
  const cacheKey = filePath
  const cached = originCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const origins = new Map<string, string>()
  const visited = new Set<string>()

  function trace(currentPath: string, depth: number): void {
    if (depth > maxDepth || visited.has(currentPath)) {
      return
    }
    visited.add(currentPath)

    const analysis = analyzeBarrel(currentPath)
    if (!analysis.isBarrel) {
      return
    }

    for (const reexport of analysis.reexports) {
      const resolved = resolveImport(reexport.specifier, currentPath, context)

      if (resolved.resolvedPath && !resolved.isExternal) {
        const originPath = resolved.resolvedPath

        // Check if the resolved file is also a barrel
        const targetAnalysis = analyzeBarrel(originPath)

        if (targetAnalysis.isBarrel) {
          // Recursively trace through this barrel
          trace(originPath, depth + 1)

          // Get origins from the nested barrel
          const nestedOrigins = originCache.get(originPath)
          if (nestedOrigins) {
            for (const [_, nestedOrigin] of nestedOrigins) {
              origins.set(reexport.specifier, nestedOrigin)
            }
          } else {
            // If no nested origins found, the target barrel is the origin
            origins.set(reexport.specifier, originPath)
          }
        } else {
          // Target is not a barrel, it's the origin
          origins.set(reexport.specifier, originPath)
        }
      }
    }
  }

  trace(filePath, 0)
  originCache.set(cacheKey, origins)
  return origins
}

/**
 * Given a target file path that may be a barrel, find the actual origin files.
 * Returns an array of origin file paths.
 *
 * If the file is not a barrel, returns an array containing just the original path.
 */
export function resolveBarrelOrigins(
  targetPath: string,
  context: ResolverContext
): string[] {
  if (!existsSync(targetPath)) {
    return [targetPath]
  }

  const analysis = analyzeBarrel(targetPath)

  if (!analysis.isBarrel) {
    // Not a barrel file, return as-is
    return [targetPath]
  }

  // Trace all re-exports to their origins
  const origins = traceOrigins(targetPath, context)

  if (origins.size === 0) {
    // No traceable origins, return the barrel itself
    return [targetPath]
  }

  // Return unique origin paths
  return Array.from(new Set(origins.values()))
}

/**
 * Clear the barrel analysis cache
 */
export function clearBarrelCache(): void {
  barrelCache.clear()
  originCache.clear()
}

/**
 * Check if a file is likely a barrel file based on its name
 */
export function isLikelyBarrelFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  const filename = normalized.split('/').pop() ?? ''
  const basename = filename.replace(/\.(ts|tsx|js|jsx|mts|mjs|cts|cjs)$/, '')
  return basename === 'index'
}
