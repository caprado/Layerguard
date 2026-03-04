/**
 * JSON output formatter
 *
 * Outputs violations and reports as JSON for tooling integration
 */

import type { Violation, ViolationReport } from '../enforcer/violations.js'

/**
 * JSON-serializable violation
 */
export interface JsonViolation {
  type: string
  severity: string
  sourceFile: string
  targetFile?: string
  sourceLayer?: string
  targetLayer?: string
  sourceSublayer?: string
  targetSublayer?: string
  sourceFeature?: string
  targetFeature?: string
  importSpecifier?: string
  line?: number
  message: string
  suggestion?: string
  cyclePath?: string[]
}

/**
 * JSON-serializable report
 */
export interface JsonReport {
  passed: boolean
  summary: {
    total: number
    errors: number
    warnings: number
    byType: {
      flow: number
      isolation: number
      circular: number
      unmapped: number
    }
  }
  violations: JsonViolation[]
}

/**
 * Convert a violation to a JSON-serializable object
 */
export function violationToJson(violation: Violation): JsonViolation {
  const json: JsonViolation = {
    type: violation.type,
    severity: violation.severity,
    sourceFile: violation.sourceFile,
    message: violation.message,
  }

  // Add optional fields only if they have values
  if (violation.targetFile) json.targetFile = violation.targetFile
  if (violation.sourceLayer) json.sourceLayer = violation.sourceLayer
  if (violation.targetLayer) json.targetLayer = violation.targetLayer
  if (violation.sourceSublayer) json.sourceSublayer = violation.sourceSublayer
  if (violation.targetSublayer) json.targetSublayer = violation.targetSublayer
  if (violation.importSpecifier) json.importSpecifier = violation.importSpecifier
  if (violation.line !== undefined) json.line = violation.line
  if (violation.suggestion) json.suggestion = violation.suggestion

  // Add type-specific fields
  if (violation.type === 'isolation') {
    const iso = violation as Violation & { sourceFeature?: string; targetFeature?: string }
    if (iso.sourceFeature) json.sourceFeature = iso.sourceFeature
    if (iso.targetFeature) json.targetFeature = iso.targetFeature
  }

  if (violation.type === 'circular') {
    const circ = violation as Violation & { cyclePath: string[] }
    json.cyclePath = circ.cyclePath
  }

  return json
}

/**
 * Convert a report to a JSON-serializable object
 */
export function reportToJson(report: ViolationReport): JsonReport {
  return {
    passed: report.passed,
    summary: {
      total: report.counts.total,
      errors: report.severityCounts.error,
      warnings: report.severityCounts.warn,
      byType: {
        flow: report.counts.flow,
        isolation: report.counts.isolation,
        circular: report.counts.circular,
        unmapped: report.counts.unmapped,
      },
    },
    violations: report.violations.map(violationToJson),
  }
}

/**
 * Format violations as JSON string
 */
export function formatJsonViolations(violations: Violation[], pretty = false): string {
  const json = violations.map(violationToJson)
  return pretty ? JSON.stringify(json, null, 2) : JSON.stringify(json)
}

/**
 * Format a full report as JSON string
 */
export function formatJsonReport(report: ViolationReport, pretty = false): string {
  const json = reportToJson(report)
  return pretty ? JSON.stringify(json, null, 2) : JSON.stringify(json)
}
