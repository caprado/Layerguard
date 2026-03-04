/**
 * Workspace detector - detects monorepo workspace configurations
 *
 * Supports:
 * - pnpm workspaces (pnpm-workspace.yaml)
 * - npm/yarn workspaces (package.json workspaces field)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

/**
 * Workspace package information
 */
export interface WorkspacePackage {
  /**
   * Package name from package.json
   */
  name: string

  /**
   * Absolute path to package directory
   */
  path: string

  /**
   * Relative path from workspace root
   */
  relativePath: string

  /**
   * Path to package.json
   */
  packageJsonPath: string
}

/**
 * Detected workspace configuration
 */
export interface WorkspaceConfig {
  /**
   * Type of workspace
   */
  type: 'pnpm' | 'npm' | 'yarn' | 'none'

  /**
   * Absolute path to workspace root
   */
  root: string

  /**
   * Workspace package patterns (globs)
   */
  patterns: string[]

  /**
   * Detected packages in the workspace
   */
  packages: WorkspacePackage[]
}

/**
 * Detect workspace configuration starting from a directory
 */
export function detectWorkspace(startDir: string): WorkspaceConfig {
  // Look for workspace root
  let currentDir = resolve(startDir)

  while (true) {
    // Check for pnpm workspace
    const pnpmWorkspacePath = join(currentDir, 'pnpm-workspace.yaml')
    if (existsSync(pnpmWorkspacePath)) {
      return parsePnpmWorkspace(currentDir, pnpmWorkspacePath)
    }

    // Check for npm/yarn workspace in package.json
    const packageJsonPath = join(currentDir, 'package.json')
    if (existsSync(packageJsonPath)) {
      const packageJson = readPackageJson(packageJsonPath)
      if (packageJson?.workspaces) {
        return parseNpmWorkspace(currentDir, packageJson.workspaces)
      }
    }

    // Move to parent directory
    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) {
      // Reached filesystem root
      break
    }
    currentDir = parentDir
  }

  // No workspace found
  return {
    type: 'none',
    root: startDir,
    patterns: [],
    packages: [],
  }
}

/**
 * Parse pnpm-workspace.yaml
 */
function parsePnpmWorkspace(root: string, workspacePath: string): WorkspaceConfig {
  try {
    const content = readFileSync(workspacePath, 'utf-8')
    // Simple YAML parsing for packages field
    const patterns = extractPnpmPackages(content)

    return {
      type: 'pnpm',
      root,
      patterns,
      packages: resolvePackages(root, patterns),
    }
  } catch {
    return {
      type: 'pnpm',
      root,
      patterns: [],
      packages: [],
    }
  }
}

/**
 * Extract packages array from pnpm-workspace.yaml content
 * Simple parser - handles common formats
 */
function extractPnpmPackages(content: string): string[] {
  const patterns: string[] = []
  const lines = content.split('\n')

  let inPackages = false
  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed === 'packages:') {
      inPackages = true
      continue
    }

    if (inPackages) {
      // Check if we've moved to a new top-level key
      if (trimmed && !trimmed.startsWith('-') && !trimmed.startsWith('#')) {
        break
      }

      // Parse package pattern
      if (trimmed.startsWith('-')) {
        let pattern = trimmed.slice(1).trim()
        // Remove quotes if present
        if ((pattern.startsWith('"') && pattern.endsWith('"')) ||
            (pattern.startsWith("'") && pattern.endsWith("'"))) {
          pattern = pattern.slice(1, -1)
        }
        if (pattern) {
          patterns.push(pattern)
        }
      }
    }
  }

  return patterns
}

/**
 * Parse npm/yarn workspaces from package.json
 */
function parseNpmWorkspace(root: string, workspaces: unknown): WorkspaceConfig {
  let patterns: string[] = []

  if (Array.isArray(workspaces)) {
    patterns = workspaces.filter((w): w is string => typeof w === 'string')
  } else if (typeof workspaces === 'object' && workspaces !== null) {
    // Yarn workspace format: { packages: [...] }
    const ws = workspaces as { packages?: unknown }
    if (Array.isArray(ws.packages)) {
      patterns = ws.packages.filter((w): w is string => typeof w === 'string')
    }
  }

  return {
    type: 'npm',
    root,
    patterns,
    packages: resolvePackages(root, patterns),
  }
}

/**
 * Resolve workspace patterns to actual packages
 */
function resolvePackages(root: string, patterns: string[]): WorkspacePackage[] {
  const packages: WorkspacePackage[] = []
  const seen = new Set<string>()

  for (const pattern of patterns) {
    // Skip negation patterns
    if (pattern.startsWith('!')) {
      continue
    }

    try {
      const matches = matchWorkspacePattern(root, pattern)

      for (const relativePath of matches) {
        const packageDir = join(root, relativePath)
        const packageJsonPath = join(packageDir, 'package.json')

        if (seen.has(packageDir)) {
          continue
        }

        if (!existsSync(packageJsonPath)) {
          continue
        }

        seen.add(packageDir)

        const packageJson = readPackageJson(packageJsonPath)
        if (packageJson?.name) {
          packages.push({
            name: packageJson.name,
            path: packageDir,
            relativePath,
            packageJsonPath,
          })
        }
      }
    } catch {
      // Pattern matching failed, skip pattern
    }
  }

  return packages
}

/**
 * Match workspace patterns to directories
 * Handles common patterns like:
 * - "packages/*" - all direct subdirectories of packages/
 * - "apps/*" - all direct subdirectories of apps/
 * - "packages/**" - all nested subdirectories
 * - "tools/foo" - specific directory
 */
function matchWorkspacePattern(root: string, pattern: string): string[] {
  const matches: string[] = []

  // Handle ** recursive patterns
  if (pattern.includes('**')) {
    const prefix = pattern.split('**')[0] ?? ''
    const baseDir = join(root, prefix.replace(/\/$/, ''))

    if (existsSync(baseDir)) {
      collectPackageDirs(baseDir, root, matches)
    }
    return matches
  }

  // Handle * wildcard at the end (most common case)
  if (pattern.endsWith('/*')) {
    const baseDir = join(root, pattern.slice(0, -2))

    if (existsSync(baseDir) && isDirectory(baseDir)) {
      const entries = readdirSync(baseDir)
      for (const entry of entries) {
        const entryPath = join(baseDir, entry)
        if (isDirectory(entryPath) && !entry.startsWith('.')) {
          const relativePath = join(pattern.slice(0, -2), entry)
          matches.push(relativePath)
        }
      }
    }
    return matches
  }

  // Literal path
  const fullPath = join(root, pattern)
  if (existsSync(fullPath) && isDirectory(fullPath)) {
    matches.push(pattern)
  }

  return matches
}

/**
 * Recursively collect all directories that contain package.json
 */
function collectPackageDirs(dir: string, root: string, matches: string[]): void {
  // Check if current dir has package.json
  if (existsSync(join(dir, 'package.json'))) {
    const relativePath = dir.slice(root.length + 1).replace(/\\/g, '/')
    if (relativePath) {
      matches.push(relativePath)
    }
  }

  // Recurse into subdirectories
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules') {
        continue
      }
      const entryPath = join(dir, entry)
      if (isDirectory(entryPath)) {
        collectPackageDirs(entryPath, root, matches)
      }
    }
  } catch {
    // Permission error or similar, skip
  }
}

/**
 * Check if path is a directory
 */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/**
 * Read and parse package.json
 */
function readPackageJson(path: string): { name?: string; workspaces?: unknown } | null {
  try {
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Find a workspace package by name
 */
export function findWorkspacePackage(
  workspace: WorkspaceConfig,
  packageName: string
): WorkspacePackage | undefined {
  return workspace.packages.find((p) => p.name === packageName)
}

/**
 * Check if an import specifier is a workspace package import
 */
export function isWorkspaceImport(
  workspace: WorkspaceConfig,
  specifier: string
): boolean {
  if (workspace.type === 'none') {
    return false
  }

  // Check if specifier matches any package name
  for (const pkg of workspace.packages) {
    if (specifier === pkg.name || specifier.startsWith(pkg.name + '/')) {
      return true
    }
  }

  return false
}

/**
 * Resolve a workspace import to its source path
 */
export function resolveWorkspaceImport(
  workspace: WorkspaceConfig,
  specifier: string
): string | null {
  for (const pkg of workspace.packages) {
    if (specifier === pkg.name) {
      // Import of package itself - resolve to main/index
      const mainFile = findPackageMain(pkg.packageJsonPath)
      if (mainFile) {
        return join(pkg.path, mainFile)
      }
      // Try common entry points
      for (const entry of ['src/index.ts', 'src/index.tsx', 'index.ts', 'index.tsx']) {
        const entryPath = join(pkg.path, entry)
        if (existsSync(entryPath)) {
          return entryPath
        }
      }
      return null
    }

    if (specifier.startsWith(pkg.name + '/')) {
      // Subpath import - resolve relative to package
      const subpath = specifier.slice(pkg.name.length + 1)
      const resolvedPath = join(pkg.path, subpath)

      // Try as directory with index first (more common for subpath imports)
      for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
        const indexPath = join(resolvedPath, 'index' + ext)
        if (existsSync(indexPath)) {
          return indexPath
        }
      }

      // Try with extensions (direct file import)
      for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
        const fullPath = resolvedPath + ext
        if (existsSync(fullPath)) {
          return fullPath
        }
      }

      // Try exact path (e.g., .json files)
      if (existsSync(resolvedPath) && isDirectory(resolvedPath) === false) {
        return resolvedPath
      }

      return null
    }
  }

  return null
}

/**
 * Find the main entry point from package.json
 */
function findPackageMain(packageJsonPath: string): string | null {
  const packageJson = readPackageJson(packageJsonPath) as {
    main?: string
    module?: string
    exports?: unknown
  } | null

  if (!packageJson) {
    return null
  }

  // Check exports field first (modern packages)
  if (packageJson.exports) {
    const exports = packageJson.exports as Record<string, unknown>
    if (typeof exports['.'] === 'string') {
      return exports['.']
    }
    if (typeof exports['.'] === 'object' && exports['.'] !== null) {
      const dotExports = exports['.'] as Record<string, unknown>
      // Prefer source > import > require > default
      for (const key of ['source', 'import', 'require', 'default']) {
        if (typeof dotExports[key] === 'string') {
          return dotExports[key] as string
        }
      }
    }
  }

  // Fallback to module or main
  return packageJson.module ?? packageJson.main ?? null
}
