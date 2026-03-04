/**
 * CI output formatter
 *
 * Outputs violations in GitHub Actions annotation format
 */

import type { Violation, ViolationReport } from '../enforcer/violations.js'

/**
 * Format a violation as a GitHub Actions annotation
 *
 * @see https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
 */
export function formatGitHubAnnotation(violation: Violation): string {
  const level = violation.severity === 'error' ? 'error' : 'warning'
  const file = violation.sourceFile
  const line = violation.line ?? 1
  const title = getAnnotationTitle(violation)
  const message = violation.message

  // Format: ::error file={name},line={line},title={title}::{message}
  return `::${level} file=${file},line=${line},title=${title}::${message}`
}

/**
 * Get a short title for the annotation
 */
function getAnnotationTitle(violation: Violation): string {
  switch (violation.type) {
    case 'flow':
      return `Layer violation: ${violation.sourceLayer} → ${violation.targetLayer}`
    case 'isolation':
      return `Feature isolation violation`
    case 'circular':
      return `Circular dependency`
    case 'unmapped':
      return `Unmapped file`
    default:
      return `Architecture violation`
  }
}

/**
 * Format all violations as GitHub Actions annotations
 */
export function formatGitHubAnnotations(violations: Violation[]): string {
  return violations.map(formatGitHubAnnotation).join('\n')
}

/**
 * Format a full report for CI output
 *
 * Includes annotations and a summary
 */
export function formatCIReport(report: ViolationReport): string {
  const lines: string[] = []

  // Output annotations
  for (const violation of report.violations) {
    lines.push(formatGitHubAnnotation(violation))
  }

  // Summary as a notice
  if (report.violations.length > 0) {
    const summary = `Found ${report.counts.total} violation(s): ${report.severityCounts.error} error(s), ${report.severityCounts.warn} warning(s)`
    lines.push(`::notice::${summary}`)
  } else {
    lines.push(`::notice::No architectural violations found`)
  }

  return lines.join('\n')
}

/**
 * Format a group start for GitHub Actions
 */
export function formatGroupStart(name: string): string {
  return `::group::${name}`
}

/**
 * Format a group end for GitHub Actions
 */
export function formatGroupEnd(): string {
  return '::endgroup::'
}

/**
 * Detect if running in GitHub Actions
 */
export function isGitHubActions(): boolean {
  return process.env.GITHUB_ACTIONS === 'true'
}

/**
 * Detect if running in any CI environment
 */
export function isCI(): boolean {
  return (
    process.env.CI === 'true' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.GITLAB_CI === 'true' ||
    process.env.CIRCLECI === 'true' ||
    process.env.TRAVIS === 'true' ||
    process.env.JENKINS_URL !== undefined
  )
}
