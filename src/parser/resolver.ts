/**
 * Import resolver - resolves import specifiers to file paths using TypeScript module resolution
 */

import ts from 'typescript'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import type { WorkspaceConfig } from '../workspace/index.js'

/**
 * Result of resolving an import
 */
export interface ResolvedImport {
  /**
   * Original import specifier
   */
  specifier: string

  /**
   * Resolved absolute file path (null if external or unresolved)
   */
  resolvedPath: string | null

  /**
   * Whether this import is external (from node_modules or node: protocol)
   */
  isExternal: boolean

  /**
   * Whether resolution failed for an internal import
   */
  isUnresolved: boolean

  /**
   * Whether this is a workspace package import
   */
  isWorkspaceImport?: boolean

  /**
   * Error message if resolution failed
   */
  error?: string
}

/**
 * Cached TypeScript program for module resolution
 */
export interface ResolverContext {
  compilerOptions: ts.CompilerOptions
  moduleResolutionHost: ts.ModuleResolutionHost
  projectRoot: string
  /**
   * Workspace configuration (for resolving workspace imports)
   */
  workspace?: WorkspaceConfig
  /**
   * Paths from all merged tsconfigs
   */
  pathMappings?: ts.MapLike<string[]>
}

/**
 * Options for creating a resolver context
 */
export interface ResolverContextOptions {
  /**
   * Project root directory
   */
  projectRoot: string

  /**
   * Path(s) to tsconfig.json file(s)
   */
  tsconfig?: string | string[]

  /**
   * Workspace configuration for resolving workspace imports
   */
  workspace?: WorkspaceConfig
}

/**
 * Create a resolver context from a tsconfig.json path
 */
export function createResolverContext(
  projectRoot: string,
  tsconfigPath?: string | string[],
  workspace?: WorkspaceConfig
): ResolverContext {
  let compilerOptions: ts.CompilerOptions = {
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    module: ts.ModuleKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    baseUrl: projectRoot,
  }

  // Normalize tsconfig paths
  const tsconfigPaths = normalizeTsconfigPaths(projectRoot, tsconfigPath)

  // Collect all tsconfig paths including project references
  const allConfigPaths = collectTsconfigsWithReferences(tsconfigPaths)

  // Merged path mappings from all tsconfigs
  let mergedPaths: ts.MapLike<string[]> = {}

  // Load and merge tsconfig files
  for (const configPath of allConfigPaths) {
    if (existsSync(configPath)) {
      const configFile = ts.readConfigFile(configPath, (path) => readFileSync(path, 'utf-8'))
      if (!configFile.error) {
        const parsed = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          dirname(configPath)
        )

        // Merge compiler options (later configs override earlier ones)
        compilerOptions = { ...compilerOptions, ...parsed.options }

        // Merge path mappings (union of all paths)
        if (parsed.options.paths) {
          mergedPaths = mergePaths(mergedPaths, parsed.options.paths)
        }
      }
    }
  }

  // Set the merged paths
  if (Object.keys(mergedPaths).length > 0) {
    compilerOptions.paths = mergedPaths
  }

  const moduleResolutionHost: ts.ModuleResolutionHost = {
    fileExists: (fileName: string) => existsSync(fileName),
    readFile: (fileName: string) => {
      try {
        return readFileSync(fileName, 'utf-8')
      } catch {
        return undefined
      }
    },
    directoryExists: (dirName: string) => {
      try {
        return existsSync(dirName)
      } catch {
        return false
      }
    },
    getCurrentDirectory: () => projectRoot,
    getDirectories: () => [],
    realpath: (path: string) => path,
  }

  const context: ResolverContext = {
    compilerOptions,
    moduleResolutionHost,
    projectRoot,
    pathMappings: mergedPaths,
  }
  if (workspace) {
    context.workspace = workspace
  }
  return context
}

/**
 * Normalize tsconfig paths to absolute paths
 */
function normalizeTsconfigPaths(projectRoot: string, tsconfig?: string | string[]): string[] {
  if (!tsconfig) {
    // Auto-detect tsconfig.json
    const autoDetected = findTsConfig(projectRoot)
    return autoDetected ? [autoDetected] : []
  }

  const paths = Array.isArray(tsconfig) ? tsconfig : [tsconfig]

  return paths.map((p) => {
    if (p.startsWith('/') || p.includes(':')) {
      // Already absolute
      return p
    }
    return join(projectRoot, p)
  })
}

/**
 * Merge path mappings from multiple tsconfigs
 */
function mergePaths(
  existing: ts.MapLike<string[]>,
  newPaths: ts.MapLike<string[]>
): ts.MapLike<string[]> {
  const result = { ...existing }

  for (const [pattern, targets] of Object.entries(newPaths)) {
    if (result[pattern]) {
      // Merge targets, avoiding duplicates
      const existingSet = new Set(result[pattern])
      for (const target of targets) {
        if (!existingSet.has(target)) {
          result[pattern] = [...result[pattern]!, target]
        }
      }
    } else {
      result[pattern] = [...targets]
    }
  }

  return result
}

/**
 * Collect all tsconfig paths including project references
 * Follows the `references` field in tsconfig.json to include referenced projects
 */
function collectTsconfigsWithReferences(tsconfigPaths: string[]): string[] {
  const collected = new Set<string>()
  const toProcess = [...tsconfigPaths]

  while (toProcess.length > 0) {
    const configPath = toProcess.pop()!

    // Skip if already processed
    if (collected.has(configPath)) {
      continue
    }

    if (!existsSync(configPath)) {
      continue
    }

    collected.add(configPath)

    // Read the config file to check for references
    try {
      const content = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content) as {
        references?: Array<{ path: string }>
      }

      // Process project references
      if (config.references && Array.isArray(config.references)) {
        const configDir = dirname(configPath)

        for (const ref of config.references) {
          if (ref.path) {
            // Resolve the reference path relative to the config file
            let refPath = resolve(configDir, ref.path)

            // If the reference points to a directory, look for tsconfig.json inside
            if (existsSync(refPath) && !refPath.endsWith('.json')) {
              const tsconfigInDir = join(refPath, 'tsconfig.json')
              if (existsSync(tsconfigInDir)) {
                refPath = tsconfigInDir
              }
            }

            if (!collected.has(refPath)) {
              toProcess.push(refPath)
            }
          }
        }
      }
    } catch {
      // Failed to parse config, skip references
    }
  }

  return Array.from(collected)
}

/**
 * Find tsconfig.json in project root or parent directories
 */
function findTsConfig(startDir: string): string | null {
  let dir = startDir
  while (true) {
    const configPath = join(dir, 'tsconfig.json')
    if (existsSync(configPath)) {
      return configPath
    }

    const parent = dirname(dir)
    if (parent === dir) {
      // Reached filesystem root
      return null
    }
    dir = parent
  }
}

/**
 * Check if an import specifier is external
 */
export function isExternalSpecifier(specifier: string): boolean {
  // Node.js built-in modules
  if (specifier.startsWith('node:')) {
    return true
  }

  // Relative imports are internal
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return false
  }

  // Everything else (package names) is external
  return true
}

/**
 * Resolve a single import specifier to a file path
 */
export function resolveImport(
  specifier: string,
  containingFile: string,
  context: ResolverContext
): ResolvedImport {
  // Skip external imports
  if (isExternalSpecifier(specifier)) {
    return {
      specifier,
      resolvedPath: null,
      isExternal: true,
      isUnresolved: false,
    }
  }

  // Use TypeScript's module resolution
  const result = ts.resolveModuleName(
    specifier,
    containingFile,
    context.compilerOptions,
    context.moduleResolutionHost
  )

  if (result.resolvedModule) {
    const resolvedPath = result.resolvedModule.resolvedFileName

    // Check if it resolved to node_modules (external)
    if (resolvedPath.includes('node_modules')) {
      return {
        specifier,
        resolvedPath: null,
        isExternal: true,
        isUnresolved: false,
      }
    }

    return {
      specifier,
      resolvedPath: resolve(resolvedPath),
      isExternal: false,
      isUnresolved: false,
    }
  }

  // Resolution failed - try manual resolution for common cases
  const manualResult = tryManualResolution(specifier, containingFile)
  if (manualResult) {
    return {
      specifier,
      resolvedPath: manualResult,
      isExternal: false,
      isUnresolved: false,
    }
  }

  return {
    specifier,
    resolvedPath: null,
    isExternal: false,
    isUnresolved: true,
    error: `Could not resolve import: ${specifier}`,
  }
}

/**
 * Try manual resolution for common patterns TypeScript might miss
 */
function tryManualResolution(specifier: string, containingFile: string): string | null {
  const containingDir = dirname(containingFile)

  // Handle relative imports
  if (specifier.startsWith('.')) {
    const basePath = resolve(containingDir, specifier)

    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs']

    // Try direct file
    for (const ext of extensions) {
      const fullPath = basePath + ext
      if (existsSync(fullPath)) {
        return fullPath
      }
    }

    // Try index file
    for (const ext of extensions) {
      const indexPath = join(basePath, `index${ext}`)
      if (existsSync(indexPath)) {
        return indexPath
      }
    }
  }

  return null
}

/**
 * Resolve multiple imports from a file
 */
export function resolveImports(
  imports: Array<{ specifier: string }>,
  containingFile: string,
  context: ResolverContext
): ResolvedImport[] {
  return imports.map((imp) => resolveImport(imp.specifier, containingFile, context))
}

/**
 * Get relative path from project root
 */
export function toRelativePath(absolutePath: string, projectRoot: string): string {
  return relative(projectRoot, absolutePath).replace(/\\/g, '/')
}
