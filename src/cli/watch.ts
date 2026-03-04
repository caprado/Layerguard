/**
 * Watch mode for layerguard
 *
 * Watches for file changes and re-runs checks incrementally
 */

import { watch, type FSWatcher } from 'node:fs'
import { join, extname } from 'node:path'
import { runCheck, type CheckCommandOptions, type CheckResult } from './check.js'
import { loadConfig } from '../config/loader.js'
import { formatSuccess } from '../output/terminal.js'

/**
 * Options for watch mode
 */
export interface WatchOptions extends Omit<CheckCommandOptions, 'format'> {
  /**
   * Debounce delay in milliseconds
   * @default 300
   */
  debounce?: number

  /**
   * Callback when check completes
   */
  onCheck?: (result: CheckResult) => void

  /**
   * Callback when error occurs
   */
  onError?: (error: Error) => void
}

/**
 * Result of starting watch mode
 */
export interface WatchHandle {
  /**
   * Stop watching
   */
  stop: () => void

  /**
   * Run check manually
   */
  runCheck: () => Promise<CheckResult>
}

/**
 * Extensions to watch for
 */
const WATCH_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs'])

/**
 * Start watch mode
 */
export async function startWatch(options: WatchOptions = {}): Promise<WatchHandle> {
  const {
    cwd = process.cwd(),
    debounce = 300,
    noColors = false,
    typeOnlyImports = false,
    onCheck,
    onError,
  } = options

  let watchers: FSWatcher[] = []
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let isRunning = false
  let pendingRun = false

  // Load config to get layer paths
  const { config } = await loadConfig(cwd)
  const layerPaths = Object.values(config.layers).map((l) => l.path)

  // Create check function
  const doCheck = async (): Promise<CheckResult> => {
    if (isRunning) {
      pendingRun = true
      return { passed: true, exitCode: 0, errorCount: 0, warningCount: 0, violations: [] }
    }

    isRunning = true
    pendingRun = false

    try {
      const result = await runCheck({
        format: 'terminal',
        cwd,
        noColors,
        typeOnlyImports,
      })
      onCheck?.(result)
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      onError?.(err)
      return { passed: false, exitCode: 1, errorCount: 1, warningCount: 0, violations: [] }
    } finally {
      isRunning = false
      if (pendingRun) {
        // Run again if changes occurred during check
        setTimeout(() => doCheck(), 100)
      }
    }
  }

  // Debounced check trigger
  const triggerCheck = (): void => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      doCheck()
    }, debounce)
  }

  // File change handler
  const handleChange = (_eventType: string, filename: string | null): void => {
    if (!filename) return

    const ext = extname(filename)
    if (!WATCH_EXTENSIONS.has(ext)) return

    // Skip if in node_modules or cache directory
    if (filename.includes('node_modules') || filename.includes('.layerguard-cache')) return

    console.log(`\n${formatSuccess(`Changed: ${filename}`, { colors: !noColors })}`)
    triggerCheck()
  }

  // Set up watchers for each layer path
  for (const layerPath of layerPaths) {
    const fullPath = join(cwd, layerPath)
    try {
      const watcher = watch(fullPath, { recursive: true }, handleChange)
      watchers.push(watcher)
    } catch {
      // Directory might not exist, that's ok
    }
  }

  // Also watch src directory if it exists and wasn't already covered
  const srcPath = join(cwd, 'src')
  if (!layerPaths.some((p) => p === 'src' || p.startsWith('src/'))) {
    try {
      const watcher = watch(srcPath, { recursive: true }, handleChange)
      watchers.push(watcher)
    } catch {
      // src directory might not exist
    }
  }

  // Print startup message
  console.log(formatSuccess('Watch mode started', { colors: !noColors }))
  console.log(`Watching ${watchers.length} director${watchers.length === 1 ? 'y' : 'ies'} for changes...`)
  console.log('')

  // Run initial check
  await doCheck()

  return {
    stop: () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      for (const watcher of watchers) {
        watcher.close()
      }
      watchers = []
      console.log(formatSuccess('Watch mode stopped', { colors: !noColors }))
    },
    runCheck: doCheck,
  }
}

/**
 * Run watch mode (blocking)
 */
export async function runWatch(options: WatchOptions = {}): Promise<void> {
  const handle = await startWatch(options)

  // Keep process alive and handle signals
  const cleanup = (): void => {
    handle.stop()
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Keep process running
  await new Promise(() => {
    // Never resolves - watch mode runs until interrupted
  })
}
