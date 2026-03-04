/**
 * Layerguard CLI entry point
 */

import { runCheck } from './check.js'
import { runShow } from './show.js'
import { runInit } from './init.js'
import { runWatch } from './watch.js'
import { runReport } from './report.js'
import { postPrComment } from '../output/github.js'
import { createViolationReport } from '../enforcer/violations.js'

export const VERSION = '0.1.1'

export interface ParsedArgs {
  command?: string
  flags: {
    help: boolean
    version: boolean
    ci: boolean
    json: boolean
    noColor: boolean
    ascii: boolean
    flowOnly: boolean
    typeOnly: boolean
    yes: boolean
    watch: boolean
    noCache: boolean
    all: boolean
    stdout: boolean
    markdown: boolean
    githubPrComment: boolean
  }
  package?: string
  output?: string
  from?: string
  title?: string
  prNumber?: number
  positional: string[]
}

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    flags: {
      help: false,
      version: false,
      ci: false,
      json: false,
      noColor: false,
      ascii: false,
      flowOnly: false,
      typeOnly: false,
      yes: false,
      watch: false,
      noCache: false,
      all: false,
      stdout: false,
      markdown: false,
      githubPrComment: false,
    },
    positional: [],
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!

    if (arg === '--help' || arg === '-h') {
      result.flags.help = true
    } else if (arg === '--version' || arg === '-v') {
      result.flags.version = true
    } else if (arg === '--ci') {
      result.flags.ci = true
    } else if (arg === '--json') {
      result.flags.json = true
    } else if (arg === '--no-color' || arg === '--no-colors') {
      result.flags.noColor = true
    } else if (arg === '--ascii') {
      result.flags.ascii = true
    } else if (arg === '--flow-only' || arg === '--flow') {
      result.flags.flowOnly = true
    } else if (arg === '--type-only') {
      result.flags.typeOnly = true
    } else if (arg === '-y' || arg === '--yes') {
      result.flags.yes = true
    } else if (arg === '--watch' || arg === '-w') {
      result.flags.watch = true
    } else if (arg === '--no-cache') {
      result.flags.noCache = true
    } else if (arg === '--all') {
      result.flags.all = true
    } else if (arg === '--stdout') {
      result.flags.stdout = true
    } else if (arg === '--markdown' || arg === '--md') {
      result.flags.markdown = true
    } else if (arg === '--package' || arg === '-p') {
      // Next arg is the package name/path
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith('-')) {
        result.package = nextArg
        i++ // Skip next arg
      }
    } else if (arg.startsWith('--package=')) {
      result.package = arg.slice('--package='.length)
    } else if (arg === '--output' || arg === '-o') {
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith('-')) {
        result.output = nextArg
        i++
      }
    } else if (arg.startsWith('--output=')) {
      result.output = arg.slice('--output='.length)
    } else if (arg === '--from') {
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith('-')) {
        result.from = nextArg
        i++
      }
    } else if (arg.startsWith('--from=')) {
      result.from = arg.slice('--from='.length)
    } else if (arg === '--title') {
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith('-')) {
        result.title = nextArg
        i++
      }
    } else if (arg.startsWith('--title=')) {
      result.title = arg.slice('--title='.length)
    } else if (arg === '--github-pr-comment' || arg === '--pr-comment') {
      result.flags.githubPrComment = true
    } else if (arg === '--pr-number') {
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith('-')) {
        result.prNumber = parseInt(nextArg, 10)
        i++
      }
    } else if (arg.startsWith('--pr-number=')) {
      result.prNumber = parseInt(arg.slice('--pr-number='.length), 10)
    } else if (!arg.startsWith('-')) {
      if (!result.command) {
        result.command = arg
      } else {
        result.positional.push(arg)
      }
    }
  }

  return result
}

/**
 * Print help message
 */
export function printHelp(): void {
  console.log(`
layerguard v${VERSION}

Enforce architectural layer boundaries in TypeScript/JavaScript projects.

Usage:
  layerguard <command> [options]

Commands:
  check       Validate architecture rules, exit 1 on violations
  show        Print the architecture as a text diagram
  init        Interactive setup to create layerguard.config.ts
  report      Generate HTML report of violations

Options:
  --help, -h      Show this help message
  --version, -v   Show version number

Check options:
  --ci              Output in GitHub Actions annotation format
  --json            Output violations as JSON
  --no-color        Disable colored output
  --type-only       Enforce rules on type-only imports
  --watch, -w       Watch mode: re-check on file changes
  --no-cache        Disable incremental caching, force full rescan
  --package, -p     Check a specific workspace package (name or path)
  --all             Check all workspace packages with layerguard configs
  --github-pr-comment  Post results as a PR comment (requires gh CLI)
  --pr-number       PR number for comment (auto-detected in GitHub Actions)

Show options:
  --ascii         Use ASCII characters instead of Unicode
  --flow-only     Show only flow rules, no diagram

Init options:
  -y, --yes       Skip prompts and use defaults

Report options:
  --output, -o    Output file path (default: layerguard-report.html)
  --markdown      Output as Markdown instead of HTML
  --stdout        Print to stdout instead of file
  --from          Load historical data from JSON file for trends
  --title         Report title

Examples:
  layerguard check                    Run validation
  layerguard check --ci               Run with GitHub Actions annotations
  layerguard check --json             Output as JSON
  layerguard check --watch            Watch for changes and re-check
  layerguard check --package apps/web Check a specific package
  layerguard check --all              Check all packages in monorepo
  layerguard show                     Display architecture diagram
  layerguard show --ascii             Display with ASCII characters
  layerguard init                     Interactive setup wizard
  layerguard init -y                  Quick setup with defaults
  layerguard report                   Generate HTML report
  layerguard report --markdown        Generate Markdown summary
  layerguard report -o report.html    Save report to custom path
`)
}

/**
 * Print version
 */
export function printVersion(): void {
  console.log(`layerguard v${VERSION}`)
}

/**
 * Main entry point
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv)

  // Handle global flags
  if (args.flags.version) {
    printVersion()
    return
  }

  if (args.flags.help || !args.command) {
    printHelp()
    return
  }

  // Route to command
  switch (args.command) {
    case 'check': {
      if (args.flags.watch) {
        // Watch mode - runs indefinitely
        await runWatch({
          noColors: args.flags.noColor,
          typeOnlyImports: args.flags.typeOnly,
          noCache: args.flags.noCache,
        })
      } else {
        const format = args.flags.json ? 'json' : args.flags.ci ? 'ci' : 'terminal'
        const checkOptions: Parameters<typeof runCheck>[0] = {
          format,
          noColors: args.flags.noColor,
          typeOnlyImports: args.flags.typeOnly,
          noCache: args.flags.noCache,
        }
        if (args.package) {
          checkOptions.package = args.package
        }
        if (args.flags.all) {
          checkOptions.all = true
        }
        const result = await runCheck(checkOptions)

        // Post PR comment if requested
        if (args.flags.githubPrComment) {
          const report = createViolationReport(result.violations)
          const commentOptions: Parameters<typeof postPrComment>[1] = {}
          if (args.prNumber) {
            commentOptions.prNumber = args.prNumber
          }
          const commentResult = postPrComment(report, commentOptions)
          if (commentResult.success) {
            if (format === 'terminal') {
              console.log(`PR comment posted: ${commentResult.commentUrl}`)
            }
          } else {
            console.error(`Failed to post PR comment: ${commentResult.error}`)
          }
        }

        process.exit(result.exitCode)
      }
      break
    }

    case 'show': {
      await runShow({
        ascii: args.flags.ascii,
        flowOnly: args.flags.flowOnly,
      })
      break
    }

    case 'init': {
      await runInit({
        yes: args.flags.yes,
      })
      break
    }

    case 'report': {
      const reportOptions: Parameters<typeof runReport>[0] = {
        format: args.flags.markdown ? 'markdown' : 'html',
        stdout: args.flags.stdout,
        noColors: args.flags.noColor,
        typeOnlyImports: args.flags.typeOnly,
      }
      if (args.output) {
        reportOptions.output = args.output
      }
      if (args.from) {
        reportOptions.from = args.from
      }
      if (args.title) {
        reportOptions.title = args.title
      }
      const reportResult = await runReport(reportOptions)
      process.exit(reportResult.success ? 0 : 1)
      break
    }

    default:
      console.error(`Unknown command: ${args.command}`)
      console.error('Run "layerguard --help" for usage.')
      process.exit(1)
  }
}

const isDirectExecution = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`
  || process.argv[1]?.endsWith('layerguard.js')

if (isDirectExecution) {
  main().catch((error) => {
    console.error('Error:', error.message)
    process.exit(1)
  })
}
