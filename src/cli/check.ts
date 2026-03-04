/**
 * archgate check command
 *
 * Validates the project against architectural rules
 */

import { loadConfig } from '../config/loader.js'
import { validateConfig } from '../config/validator.js'
import { buildDependencyGraphIncremental } from '../parser/incremental.js'
import { createFlowChecker } from '../enforcer/checker.js'
import { detectCircularDependencies } from '../enforcer/circular.js'
import { createViolationReport, type Violation } from '../enforcer/violations.js'
import { formatReport, formatStats, formatError, formatSuccess } from '../output/terminal.js'
import { formatCIReport, isGitHubActions } from '../output/ci.js'
import { formatJsonReport } from '../output/json.js'
import { getPlugin } from '../plugins/registry.js'
import {
  detectWorkspace,
  discoverPackageConfigs,
  findPackageConfig,
} from '../workspace/index.js'

/**
 * Options for the check command
 */
export interface CheckCommandOptions {
  /**
   * Output format
   */
  format?: 'terminal' | 'ci' | 'json'

  /**
   * Project root directory
   */
  cwd?: string

  /**
   * Path to config file
   */
  config?: string

  /**
   * Whether to include type-only imports in enforcement
   */
  typeOnlyImports?: boolean

  /**
   * Don't use colors in output
   */
  noColors?: boolean

  /**
   * Disable caching for a full rescan
   * @default false
   */
  noCache?: boolean

  /**
   * Check a specific workspace package (name or path)
   */
  package?: string

  /**
   * Check all workspace packages with archgate configs
   */
  all?: boolean
}

/**
 * Result of the check command
 */
export interface CheckResult {
  /**
   * Whether the check passed (no errors)
   */
  passed: boolean

  /**
   * Exit code (0 for success, 1 for errors)
   */
  exitCode: number

  /**
   * Number of errors
   */
  errorCount: number

  /**
   * Number of warnings
   */
  warningCount: number

  /**
   * All violations found
   */
  violations: Violation[]
}

/**
 * Run the check command
 */
export async function runCheck(options: CheckCommandOptions = {}): Promise<CheckResult> {
  const {
    format = isGitHubActions() ? 'ci' : 'terminal',
    cwd = process.cwd(),
    typeOnlyImports = false,
    noColors = false,
    noCache = false,
    package: packageFilter,
    all: checkAll,
  } = options

  // Handle workspace package checking
  if (packageFilter || checkAll) {
    return runWorkspaceCheck(options)
  }

  const startTime = Date.now()

  try {
    // Load and validate config
    const { config, configPath } = await loadConfig(cwd)

    const validation = validateConfig(config, cwd)
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => e.message).join('\n')
      console.error(formatError(`Invalid config at ${configPath}:\n${errorMessages}`, { colors: !noColors }))
      return { passed: false, exitCode: 1, errorCount: 1, warningCount: 0, violations: [] }
    }

    // Print warnings from validation
    if (validation.warnings.length > 0 && format === 'terminal') {
      for (const warning of validation.warnings) {
        console.warn(`Warning: ${warning.message}`)
      }
    }

    // Get plugin for framework-specific ignore patterns
    const plugin = config.framework ? getPlugin(config.framework) : undefined
    const pluginIgnorePatterns = plugin?.defaultIgnorePatterns ?? []

    // Merge config ignore patterns with plugin ignore patterns
    const allIgnorePatterns = [...(config.ignore ?? []), ...pluginIgnorePatterns]

    // Build dependency graph (with incremental caching)
    const buildOptions: Parameters<typeof buildDependencyGraphIncremental>[0] = {
      projectRoot: cwd,
      config,
      includeTypeOnlyImports: typeOnlyImports || config.rules?.typeOnlyImports === 'enforce',
      useCache: !noCache,
    }
    if (allIgnorePatterns.length > 0) {
      buildOptions.ignore = allIgnorePatterns
    }
    const buildResult = buildDependencyGraphIncremental(buildOptions)
    const graph = buildResult.graph

    // Run flow checker
    const checker = createFlowChecker(config)
    const flowViolations = checker.checkGraph(graph, {
      unmappedSeverity: 'warn',
      unlayeredImports: config.rules?.unlayeredImports ?? 'ignore',
      barrelResolution: config.rules?.barrelResolution ?? 'import-site',
      orphans: config.rules?.orphans ?? 'off',
      projectRoot: cwd,
    })

    // Run circular dependency detection
    const circularSeverity = config.rules?.circular ?? 'error'
    let circularViolations: Violation[] = []
    if (circularSeverity !== 'off') {
      const circularResult = detectCircularDependencies(graph, circularSeverity)
      circularViolations = circularResult.violations
    }

    // Combine all violations
    const allViolations = [...flowViolations, ...circularViolations]
    const report = createViolationReport(allViolations)

    // Output based on format
    const duration = Date.now() - startTime

    if (format === 'json') {
      console.log(formatJsonReport(report, true))
    } else if (format === 'ci') {
      console.log(formatCIReport(report))
    } else {
      console.log(formatReport(report, { colors: !noColors }))
      console.log(formatStats({
        fileCount: graph.files.size,
        edgeCount: graph.edges.length,
        duration,
        cacheHit: buildResult.cacheHit,
        filesParsed: buildResult.filesParsed,
      }, { colors: !noColors }))
      console.log('')
    }

    return {
      passed: report.passed,
      exitCode: report.passed ? 0 : 1,
      errorCount: report.severityCounts.error,
      warningCount: report.severityCounts.warn,
      violations: allViolations,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (format === 'json') {
      console.log(JSON.stringify({ error: message }, null, 2))
    } else if (format === 'ci') {
      console.log(`::error::${message}`)
    } else {
      console.error(formatError(message, { colors: !noColors }))
    }

    return { passed: false, exitCode: 1, errorCount: 1, warningCount: 0, violations: [] }
  }
}

/**
 * Result for a single package check
 */
interface PackageCheckResult extends CheckResult {
  /**
   * Package name
   */
  packageName: string

  /**
   * Package path
   */
  packagePath: string
}

/**
 * Run check on workspace packages
 */
async function runWorkspaceCheck(options: CheckCommandOptions): Promise<CheckResult> {
  const {
    format = isGitHubActions() ? 'ci' : 'terminal',
    cwd = process.cwd(),
    noColors = false,
    package: packageFilter,
    all: checkAll,
  } = options

  const startTime = Date.now()

  try {
    // Detect workspace
    const workspace = detectWorkspace(cwd)

    if (workspace.type === 'none') {
      console.error(formatError('No workspace detected. Use --package or --all in a monorepo.', { colors: !noColors }))
      return { passed: false, exitCode: 1, errorCount: 1, warningCount: 0, violations: [] }
    }

    // Discover package configs
    const discovery = discoverPackageConfigs(workspace)

    if (discovery.packageConfigs.length === 0 && !discovery.rootConfig) {
      console.error(formatError('No archgate configs found in workspace packages.', { colors: !noColors }))
      return { passed: false, exitCode: 1, errorCount: 1, warningCount: 0, violations: [] }
    }

    let packagesToCheck: typeof discovery.packageConfigs = []

    if (packageFilter) {
      // Find specific package
      const found = findPackageConfig(discovery, packageFilter)
      if (!found) {
        const available = discovery.packageConfigs.map(pc => pc.package.name).join(', ')
        console.error(formatError(`Package "${packageFilter}" not found or has no archgate config.\nAvailable packages: ${available}`, { colors: !noColors }))
        return { passed: false, exitCode: 1, errorCount: 1, warningCount: 0, violations: [] }
      }
      packagesToCheck = [found]
    } else if (checkAll) {
      packagesToCheck = discovery.packageConfigs
    }

    if (packagesToCheck.length === 0) {
      console.error(formatError('No packages to check.', { colors: !noColors }))
      return { passed: false, exitCode: 1, errorCount: 1, warningCount: 0, violations: [] }
    }

    // Run checks on each package
    const results: PackageCheckResult[] = []
    let totalErrors = 0
    let totalWarnings = 0
    const allViolations: Violation[] = []

    for (const pkgConfig of packagesToCheck) {
      if (format === 'terminal') {
        console.log(`\n${'─'.repeat(60)}`)
        console.log(`Checking: ${pkgConfig.package.name} (${pkgConfig.package.relativePath})`)
        console.log('─'.repeat(60))
      }

      // Run check for this package (without workspace options to run single-package check)
      const singlePackageOptions: CheckCommandOptions = {
        cwd: pkgConfig.package.path,
      }
      if (options.format) {
        singlePackageOptions.format = options.format
      }
      if (options.config) {
        singlePackageOptions.config = options.config
      }
      if (options.typeOnlyImports !== undefined) {
        singlePackageOptions.typeOnlyImports = options.typeOnlyImports
      }
      if (options.noColors !== undefined) {
        singlePackageOptions.noColors = options.noColors
      }
      if (options.noCache !== undefined) {
        singlePackageOptions.noCache = options.noCache
      }
      const result = await runCheck(singlePackageOptions)

      results.push({
        ...result,
        packageName: pkgConfig.package.name,
        packagePath: pkgConfig.package.path,
      })

      totalErrors += result.errorCount
      totalWarnings += result.warningCount
      allViolations.push(...result.violations)
    }

    // Print summary
    const duration = Date.now() - startTime
    const allPassed = results.every(r => r.passed)

    if (format === 'terminal') {
      console.log(`\n${'═'.repeat(60)}`)
      console.log('Workspace Summary')
      console.log('═'.repeat(60))
      for (const result of results) {
        const status = result.passed ? formatSuccess('✓', { colors: !noColors }) : formatError('✗', { colors: !noColors })
        console.log(`  ${status} ${result.packageName}: ${result.errorCount} errors, ${result.warningCount} warnings`)
      }
      console.log('')
      console.log(`Total: ${totalErrors} errors, ${totalWarnings} warnings`)
      console.log(`Duration: ${duration}ms`)
      console.log('')
    } else if (format === 'json') {
      console.log(JSON.stringify({
        passed: allPassed,
        packages: results.map(r => ({
          name: r.packageName,
          path: r.packagePath,
          passed: r.passed,
          errorCount: r.errorCount,
          warningCount: r.warningCount,
        })),
        totalErrors,
        totalWarnings,
        duration,
      }, null, 2))
    }

    return {
      passed: allPassed,
      exitCode: allPassed ? 0 : 1,
      errorCount: totalErrors,
      warningCount: totalWarnings,
      violations: allViolations,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(formatError(message, { colors: !noColors }))
    return { passed: false, exitCode: 1, errorCount: 1, warningCount: 0, violations: [] }
  }
}
