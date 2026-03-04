/**
 * Per-package Archgate config discovery
 *
 * Finds and loads archgate configs from workspace packages
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { WorkspaceConfig, WorkspacePackage } from './detector.js'
import { loadConfig } from '../config/loader.js'
import type { ArchgateConfig } from '../config/types.js'

/**
 * Package config information
 */
export interface PackageConfig {
  /**
   * Package information
   */
  package: WorkspacePackage

  /**
   * Path to the archgate config file
   */
  configPath: string

  /**
   * Loaded config (null if not loaded yet)
   */
  config: ArchgateConfig | null
}

/**
 * Result of discovering package configs
 */
export interface PackageConfigDiscovery {
  /**
   * Workspace root config (if exists)
   */
  rootConfig: PackageConfig | null

  /**
   * Package configs
   */
  packageConfigs: PackageConfig[]
}

/**
 * Known archgate config file names
 */
const CONFIG_FILE_NAMES = [
  'archgate.config.ts',
  'archgate.config.js',
  'archgate.config.mjs',
  '.archgaterc.ts',
  '.archgaterc.js',
]

/**
 * Discover archgate configs in a workspace
 */
export function discoverPackageConfigs(workspace: WorkspaceConfig): PackageConfigDiscovery {
  const packageConfigs: PackageConfig[] = []

  // Check each package for an archgate config
  for (const pkg of workspace.packages) {
    const configPath = findConfigInDirectory(pkg.path)
    if (configPath) {
      packageConfigs.push({
        package: pkg,
        configPath,
        config: null,
      })
    }
  }

  // Check for root config
  const rootConfigPath = findConfigInDirectory(workspace.root)
  const rootConfig: PackageConfig | null = rootConfigPath
    ? {
        package: {
          name: 'root',
          path: workspace.root,
          relativePath: '.',
          packageJsonPath: join(workspace.root, 'package.json'),
        },
        configPath: rootConfigPath,
        config: null,
      }
    : null

  return {
    rootConfig,
    packageConfigs,
  }
}

/**
 * Find archgate config file in a directory
 */
function findConfigInDirectory(dir: string): string | null {
  for (const name of CONFIG_FILE_NAMES) {
    const path = join(dir, name)
    if (existsSync(path)) {
      return path
    }
  }
  return null
}

/**
 * Load a specific package config
 */
export async function loadPackageConfig(
  packageConfig: PackageConfig
): Promise<ArchgateConfig> {
  const { config } = await loadConfig(packageConfig.package.path)
  return config
}

/**
 * Find a package config by name or path
 */
export function findPackageConfig(
  discovery: PackageConfigDiscovery,
  nameOrPath: string
): PackageConfig | null {
  // Try exact name match
  const byName = discovery.packageConfigs.find(
    (pc) => pc.package.name === nameOrPath
  )
  if (byName) {
    return byName
  }

  // Try path match
  const normalizedPath = nameOrPath.replace(/\\/g, '/')
  const byPath = discovery.packageConfigs.find((pc) => {
    const pkgPath = pc.package.relativePath.replace(/\\/g, '/')
    return pkgPath === normalizedPath || pkgPath.endsWith('/' + normalizedPath)
  })
  if (byPath) {
    return byPath
  }

  return null
}

/**
 * Get all package names that have archgate configs
 */
export function getConfiguredPackageNames(discovery: PackageConfigDiscovery): string[] {
  return discovery.packageConfigs.map((pc) => pc.package.name)
}
