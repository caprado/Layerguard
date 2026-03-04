/**
 * Terminal output formatter
 *
 * Pretty-prints violations and results for terminal display
 */

import type { Violation, ViolationReport, CircularViolation } from '../enforcer/violations.js'

/**
 * ANSI color codes
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

/**
 * Options for terminal output
 */
export interface TerminalOptions {
  /**
   * Whether to use colors
   * @default true
   */
  colors?: boolean

  /**
   * Whether to show suggestions
   * @default true
   */
  showSuggestions?: boolean
}

/**
 * Apply color if enabled
 */
function color(text: string, colorCode: string, enabled: boolean): string {
  return enabled ? `${colorCode}${text}${colors.reset}` : text
}

/**
 * Format a single violation for terminal output
 */
export function formatViolation(violation: Violation, options: TerminalOptions = {}): string {
  const { colors: useColors = true, showSuggestions = true } = options
  const lines: string[] = []

  // Severity badge
  const severityBadge =
    violation.severity === 'error'
      ? color('ERROR', colors.red + colors.bold, useColors)
      : color('WARN', colors.yellow + colors.bold, useColors)

  // Type label
  const typeLabel = getTypeLabel(violation.type)

  // Header line
  lines.push(`  ${severityBadge}  ${typeLabel}`)

  // File info
  if (violation.type === 'circular') {
    // For circular, show the full cycle path
    const circularViolation = violation as CircularViolation
    lines.push(`  ${color(circularViolation.cyclePath.join(' → '), colors.cyan, useColors)}`)
  } else if (violation.targetFile) {
    const lineInfo = violation.line ? `:${violation.line}` : ''
    lines.push(
      `  ${color(violation.sourceFile + lineInfo, colors.cyan, useColors)} → ${color(violation.targetFile, colors.cyan, useColors)}`
    )
  } else {
    lines.push(`  ${color(violation.sourceFile, colors.cyan, useColors)}`)
  }

  // Message
  lines.push(`  ${color(violation.message, colors.dim, useColors)}`)

  // Suggestion
  if (showSuggestions && violation.suggestion) {
    lines.push(`  ${color('Fix:', colors.green, useColors)} ${violation.suggestion}`)
  }

  return lines.join('\n')
}

/**
 * Get a human-readable label for violation type
 */
function getTypeLabel(type: string): string {
  switch (type) {
    case 'flow':
      return 'Layer violation'
    case 'isolation':
      return 'Feature isolation'
    case 'circular':
      return 'Circular dependency'
    case 'unmapped':
      return 'Unmapped file'
    default:
      return type
  }
}

/**
 * Format a full violation report for terminal output
 */
export function formatReport(report: ViolationReport, options: TerminalOptions = {}): string {
  const { colors: useColors = true } = options
  const lines: string[] = []

  // Header
  lines.push('')
  lines.push(color('layerguard check', colors.bold, useColors))
  lines.push('')

  if (report.violations.length === 0) {
    lines.push(
      `  ${color('✓', colors.green, useColors)} ${color('No violations found', colors.green, useColors)}`
    )
    lines.push('')
    return lines.join('\n')
  }

  // Summary line
  const errorCount = report.severityCounts.error
  const warnCount = report.severityCounts.warn
  const summaryParts: string[] = []

  if (errorCount > 0) {
    summaryParts.push(color(`${errorCount} error${errorCount === 1 ? '' : 's'}`, colors.red, useColors))
  }
  if (warnCount > 0) {
    summaryParts.push(color(`${warnCount} warning${warnCount === 1 ? '' : 's'}`, colors.yellow, useColors))
  }

  const checkMark = report.passed
    ? color('✓', colors.green, useColors)
    : color('✗', colors.red, useColors)

  lines.push(`  ${checkMark} ${report.counts.total} violation${report.counts.total === 1 ? '' : 's'} found (${summaryParts.join(', ')})`)
  lines.push('')

  // Group violations by type
  const grouped = groupViolationsByType(report.violations)

  for (const [type, violations] of grouped) {
    if (violations.length === 0) continue

    lines.push(color(`  ${getTypeLabel(type)} (${violations.length})`, colors.bold, useColors))
    lines.push('')

    for (const violation of violations) {
      lines.push(formatViolation(violation, options))
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Group violations by type
 */
function groupViolationsByType(violations: Violation[]): Map<string, Violation[]> {
  const groups = new Map<string, Violation[]>([
    ['flow', []],
    ['isolation', []],
    ['circular', []],
    ['unmapped', []],
  ])

  for (const v of violations) {
    const group = groups.get(v.type)
    if (group) {
      group.push(v)
    }
  }

  return groups
}

/**
 * Format a simple success message
 */
export function formatSuccess(message: string, options: TerminalOptions = {}): string {
  const { colors: useColors = true } = options
  return `${color('✓', colors.green, useColors)} ${message}`
}

/**
 * Format a simple error message
 */
export function formatError(message: string, options: TerminalOptions = {}): string {
  const { colors: useColors = true } = options
  return `${color('✗', colors.red, useColors)} ${message}`
}

/**
 * Format statistics about the check
 */
export function formatStats(stats: {
  fileCount: number
  edgeCount: number
  duration?: number
  cacheHit?: boolean
  filesParsed?: number
}, options: TerminalOptions = {}): string {
  const { colors: useColors = true } = options
  const parts = [
    `${stats.fileCount} file${stats.fileCount === 1 ? '' : 's'}`,
    `${stats.edgeCount} import${stats.edgeCount === 1 ? '' : 's'}`,
  ]

  if (stats.duration !== undefined) {
    parts.push(`${stats.duration}ms`)
  }

  // Show cache info if incremental build was used
  if (stats.cacheHit !== undefined) {
    if (stats.cacheHit && stats.filesParsed !== undefined) {
      if (stats.filesParsed === 0) {
        parts.push('cached')
      } else {
        parts.push(`${stats.filesParsed} reparsed`)
      }
    }
  }

  return color(parts.join(' · '), colors.dim, useColors)
}
