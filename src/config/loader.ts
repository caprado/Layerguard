/**
 * Config file loader using jiti for TypeScript/JavaScript config files
 */

import { createJiti } from 'jiti'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ArchgateConfig } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Supported config file names in order of priority
 */
const CONFIG_FILES = [
  'archgate.config.ts',
  'archgate.config.js',
  'archgate.config.mjs',
  'archgate.config.cjs',
] as const

export interface LoadConfigResult {
  config: ArchgateConfig
  configPath: string
}

export class ConfigNotFoundError extends Error {
  constructor(searchedPaths: string[]) {
    super(
      `No archgate config file found. Searched for:\n${searchedPaths.map((p) => `  - ${p}`).join('\n')}\n\nRun 'archgate init' to create one.`
    )
    this.name = 'ConfigNotFoundError'
  }
}

export class ConfigLoadError extends Error {
  constructor(
    configPath: string,
    cause: unknown
  ) {
    const message = cause instanceof Error ? cause.message : String(cause)
    super(`Failed to load config from ${configPath}: ${message}`)
    this.name = 'ConfigLoadError'
    this.cause = cause
  }
}

/**
 * Find the config file in the given directory
 */
export function findConfigFile(cwd: string): string | null {
  for (const filename of CONFIG_FILES) {
    const configPath = resolve(cwd, filename)
    if (existsSync(configPath)) {
      return configPath
    }
  }
  return null
}

/**
 * Load and parse the archgate config file
 *
 * @param cwd - The directory to search for the config file (defaults to process.cwd())
 * @returns The loaded config and its path
 * @throws ConfigNotFoundError if no config file is found
 * @throws ConfigLoadError if the config file fails to load
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<LoadConfigResult> {
  const configPath = findConfigFile(cwd)

  if (!configPath) {
    const searchedPaths = CONFIG_FILES.map((f) => resolve(cwd, f))
    throw new ConfigNotFoundError(searchedPaths)
  }

  try {
    const jiti = createJiti(__dirname, {
      interopDefault: true,
      moduleCache: false,
    })

    const loaded = await jiti.import(configPath)
    const config = (loaded as { default?: ArchgateConfig }).default ?? (loaded as ArchgateConfig)

    if (!config || typeof config !== 'object') {
      throw new Error('Config file must export a valid configuration object')
    }

    return { config, configPath }
  } catch (error) {
    if (error instanceof ConfigNotFoundError || error instanceof ConfigLoadError) {
      throw error
    }
    throw new ConfigLoadError(configPath, error)
  }
}

/**
 * Load config synchronously (for ESLint integration)
 *
 * @param cwd - The directory to search for the config file
 * @returns The loaded config and its path, or null if not found
 */
export function loadConfigSync(cwd: string): LoadConfigResult | null {
  const configPath = findConfigFile(cwd)

  if (!configPath) {
    return null
  }

  try {
    const jiti = createJiti(__dirname, {
      interopDefault: true,
      moduleCache: false,
    })

    // jiti supports sync imports
    const loaded = jiti(configPath)
    const config = (loaded as { default?: ArchgateConfig }).default ?? (loaded as ArchgateConfig)

    if (!config || typeof config !== 'object') {
      return null
    }

    return { config, configPath }
  } catch {
    return null
  }
}
