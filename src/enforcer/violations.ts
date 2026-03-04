/**
 * Violation types and collection
 */

/**
 * Types of architectural violations
 */
export type ViolationType =
  | 'flow'
  | 'isolation'
  | 'circular'
  | 'unmapped'
  | 'unlayered'
  | 'orphan'
  | 'depth'
  | 'publicApi'
  | 'dependentBudget'
  | 'importCount'

/**
 * Severity levels for violations
 */
export type ViolationSeverity = 'error' | 'warn'

/**
 * A single architectural violation
 */
export interface Violation {
  /**
   * Type of violation
   */
  type: ViolationType

  /**
   * Severity level
   */
  severity: ViolationSeverity

  /**
   * Source file path (relative to project root)
   */
  sourceFile: string

  /**
   * Target file path (relative to project root), if applicable
   */
  targetFile?: string

  /**
   * Source layer name
   */
  sourceLayer?: string

  /**
   * Source sublayer name, if applicable
   */
  sourceSublayer?: string

  /**
   * Target layer name, if applicable
   */
  targetLayer?: string

  /**
   * Target sublayer name, if applicable
   */
  targetSublayer?: string

  /**
   * The raw import specifier that caused the violation
   */
  importSpecifier?: string

  /**
   * Line number in source file
   */
  line?: number

  /**
   * Human-readable explanation of the violation
   */
  message: string

  /**
   * Suggested fix
   */
  suggestion?: string
}

/**
 * Flow violation - importing against the declared flow direction
 */
export interface FlowViolation extends Violation {
  type: 'flow'
  targetFile: string
  sourceLayer: string
  targetLayer: string
  importSpecifier: string
}

/**
 * Isolation violation - cross-feature import in isolated sublayer
 */
export interface IsolationViolation extends Violation {
  type: 'isolation'
  targetFile: string
  sourceLayer: string
  sourceSublayer: string
  targetSublayer: string
  sourceFeature: string
  targetFeature: string
  importSpecifier: string
}

/**
 * Circular dependency violation
 */
export interface CircularViolation extends Violation {
  type: 'circular'
  /**
   * The cycle path (list of files in the cycle)
   */
  cyclePath: string[]
}

/**
 * Unmapped file violation - file doesn't belong to any layer
 */
export interface UnmappedViolation extends Violation {
  type: 'unmapped'
}

/**
 * Unlayered import violation - layered file imports from unlayered file
 * Only triggered when unlayeredImports is set to 'error' or 'warn'
 */
export interface UnlayeredViolation extends Violation {
  type: 'unlayered'
  targetFile: string
  sourceLayer: string
  importSpecifier: string
}

/**
 * Orphan violation - file is not imported by any other file
 */
export interface OrphanViolation extends Violation {
  type: 'orphan'
  /**
   * The layer this orphan belongs to (if any)
   */
  layer: string | undefined
}

/**
 * Depth violation - import chain exceeds maxImportDepth
 */
export interface DepthViolation extends Violation {
  type: 'depth'
  /**
   * The import chain that exceeds the depth limit
   */
  importChain: string[]
  /**
   * The maximum allowed depth
   */
  maxDepth: number
  /**
   * The actual depth of this chain
   */
  actualDepth: number
}

/**
 * Public API violation - importing from a non-public file in a layer
 */
export interface PublicApiViolation extends Violation {
  type: 'publicApi'
  targetFile: string
  sourceLayer: string
  targetLayer: string
  /**
   * The public API file(s) that should be used instead
   */
  publicApiFiles: string[]
  importSpecifier: string
}

/**
 * Dependent budget violation - layer has too many dependents
 */
export interface DependentBudgetViolation extends Violation {
  type: 'dependentBudget'
  /**
   * The layer that has exceeded its dependent budget
   */
  targetLayer: string
  /**
   * Maximum allowed dependents
   */
  maxDependents: number
  /**
   * Actual number of dependents
   */
  actualDependents: number
  /**
   * List of layers that depend on this layer
   */
  dependentLayers: string[]
}

/**
 * Import count violation - file has too many imports
 */
export interface ImportCountViolation extends Violation {
  type: 'importCount'
  /**
   * Maximum allowed imports
   */
  maxImports: number
  /**
   * Actual number of imports
   */
  actualImports: number
}

/**
 * Collection of all violations from an enforcement run
 */
export interface ViolationReport {
  /**
   * All violations found
   */
  violations: Violation[]

  /**
   * Count by type
   */
  counts: {
    flow: number
    isolation: number
    circular: number
    unmapped: number
    unlayered: number
    orphan: number
    depth: number
    publicApi: number
    dependentBudget: number
    importCount: number
    total: number
  }

  /**
   * Count by severity
   */
  severityCounts: {
    error: number
    warn: number
  }

  /**
   * Whether the check passed (no errors)
   */
  passed: boolean
}

/**
 * Create a flow violation
 */
export function createFlowViolation(params: {
  sourceFile: string
  targetFile: string
  sourceLayer: string
  targetLayer: string
  importSpecifier: string
  line?: number
  severity?: ViolationSeverity
}): FlowViolation {
  const { sourceFile, targetFile, sourceLayer, targetLayer, importSpecifier, line, severity = 'error' } = params

  const violation: FlowViolation = {
    type: 'flow',
    severity,
    sourceFile,
    targetFile,
    sourceLayer,
    targetLayer,
    importSpecifier,
    message: `Layer violation: ${sourceLayer} cannot import from ${targetLayer}`,
    suggestion: `Move shared logic to a common layer that both can access, or restructure the dependency.`,
  }

  if (line !== undefined) {
    violation.line = line
  }

  return violation
}

/**
 * Create an isolation violation
 */
export function createIsolationViolation(params: {
  sourceFile: string
  targetFile: string
  sourceLayer: string
  sourceSublayer: string
  targetSublayer: string
  sourceFeature: string
  targetFeature: string
  importSpecifier: string
  line?: number
  severity?: ViolationSeverity
}): IsolationViolation {
  const {
    sourceFile,
    targetFile,
    sourceLayer,
    sourceSublayer,
    targetSublayer,
    sourceFeature,
    targetFeature,
    importSpecifier,
    line,
    severity = 'error',
  } = params

  const violation: IsolationViolation = {
    type: 'isolation',
    severity,
    sourceFile,
    targetFile,
    sourceLayer,
    sourceSublayer,
    targetSublayer,
    sourceFeature,
    targetFeature,
    importSpecifier,
    message: `Feature isolation: ${sourceFeature} cannot import from ${targetFeature}`,
    suggestion: `Extract shared logic to a non-isolated sublayer (e.g., shared/).`,
  }

  if (line !== undefined) {
    violation.line = line
  }

  return violation
}

/**
 * Create a circular dependency violation
 */
export function createCircularViolation(params: {
  cyclePath: string[]
  severity?: ViolationSeverity
}): CircularViolation {
  const { cyclePath, severity = 'error' } = params
  const cycleStr = cyclePath.join(' → ')

  return {
    type: 'circular',
    severity,
    sourceFile: cyclePath[0] ?? '',
    cyclePath,
    message: `Circular dependency: ${cycleStr}`,
    suggestion: `Break the cycle by extracting shared logic into a separate module.`,
  }
}

/**
 * Create an unmapped file violation
 */
export function createUnmappedViolation(params: {
  sourceFile: string
  severity?: ViolationSeverity
}): UnmappedViolation {
  const { sourceFile, severity = 'warn' } = params

  return {
    type: 'unmapped',
    severity,
    sourceFile,
    message: `File does not belong to any defined layer: ${sourceFile}`,
    suggestion: `Add a layer definition that includes this file, or add it to ignore patterns.`,
  }
}

/**
 * Create an unlayered import violation
 */
export function createUnlayeredViolation(params: {
  sourceFile: string
  targetFile: string
  sourceLayer: string
  importSpecifier: string
  line?: number
  severity?: ViolationSeverity
}): UnlayeredViolation {
  const { sourceFile, targetFile, sourceLayer, importSpecifier, line, severity = 'error' } = params

  const violation: UnlayeredViolation = {
    type: 'unlayered',
    severity,
    sourceFile,
    targetFile,
    sourceLayer,
    importSpecifier,
    message: `Import from unlayered file: ${sourceLayer} imports ${targetFile}`,
    suggestion: `Add the target file to a layer, or set unlayeredImports to 'ignore'.`,
  }

  if (line !== undefined) {
    violation.line = line
  }

  return violation
}

/**
 * Create an orphan violation
 */
export function createOrphanViolation(params: {
  sourceFile: string
  layer?: string
  severity?: ViolationSeverity
}): OrphanViolation {
  const { sourceFile, layer, severity = 'warn' } = params

  return {
    type: 'orphan',
    severity,
    sourceFile,
    layer,
    message: `Orphan file: ${sourceFile} is not imported by any other file`,
    suggestion: `Remove the file if unused, or add it to an entry point.`,
  }
}

/**
 * Create a depth violation
 */
export function createDepthViolation(params: {
  sourceFile: string
  importChain: string[]
  maxDepth: number
  actualDepth: number
  severity?: ViolationSeverity
}): DepthViolation {
  const { sourceFile, importChain, maxDepth, actualDepth, severity = 'warn' } = params
  const chainStr = importChain.join(' → ')

  return {
    type: 'depth',
    severity,
    sourceFile,
    importChain,
    maxDepth,
    actualDepth,
    message: `Import chain too deep (${actualDepth} > ${maxDepth}): ${chainStr}`,
    suggestion: `Reduce transitive dependencies or consider a flatter architecture.`,
  }
}

/**
 * Create a public API violation
 */
export function createPublicApiViolation(params: {
  sourceFile: string
  targetFile: string
  sourceLayer: string
  targetLayer: string
  publicApiFiles: string[]
  importSpecifier: string
  line?: number
  severity?: ViolationSeverity
}): PublicApiViolation {
  const {
    sourceFile,
    targetFile,
    sourceLayer,
    targetLayer,
    publicApiFiles,
    importSpecifier,
    line,
    severity = 'error',
  } = params

  const apiFilesStr = publicApiFiles.join(', ')
  const violation: PublicApiViolation = {
    type: 'publicApi',
    severity,
    sourceFile,
    targetFile,
    sourceLayer,
    targetLayer,
    publicApiFiles,
    importSpecifier,
    message: `Private import: ${targetFile} is not part of ${targetLayer}'s public API`,
    suggestion: `Import from the public API file(s) instead: ${apiFilesStr}`,
  }

  if (line !== undefined) {
    violation.line = line
  }

  return violation
}

/**
 * Create a dependent budget violation
 */
export function createDependentBudgetViolation(params: {
  targetLayer: string
  maxDependents: number
  actualDependents: number
  dependentLayers: string[]
  severity?: ViolationSeverity
}): DependentBudgetViolation {
  const { targetLayer, maxDependents, actualDependents, dependentLayers, severity = 'warn' } = params
  const dependentsStr = dependentLayers.join(', ')

  return {
    type: 'dependentBudget',
    severity,
    sourceFile: '',
    targetLayer,
    maxDependents,
    actualDependents,
    dependentLayers,
    message: `Layer "${targetLayer}" has too many dependents (${actualDependents} > ${maxDependents})`,
    suggestion: `Consider splitting the layer or reducing coupling. Current dependents: ${dependentsStr}`,
  }
}

/**
 * Create an import count violation
 */
export function createImportCountViolation(params: {
  sourceFile: string
  maxImports: number
  actualImports: number
  severity?: ViolationSeverity
}): ImportCountViolation {
  const { sourceFile, maxImports, actualImports, severity = 'warn' } = params

  return {
    type: 'importCount',
    severity,
    sourceFile,
    maxImports,
    actualImports,
    message: `Too many imports in ${sourceFile} (${actualImports} > ${maxImports})`,
    suggestion: `Consider splitting the file into smaller modules or reducing dependencies.`,
  }
}

/**
 * Create a violation report from a list of violations
 */
export function createViolationReport(violations: Violation[]): ViolationReport {
  const counts = {
    flow: 0,
    isolation: 0,
    circular: 0,
    unmapped: 0,
    unlayered: 0,
    orphan: 0,
    depth: 0,
    publicApi: 0,
    dependentBudget: 0,
    importCount: 0,
    total: violations.length,
  }

  const severityCounts = {
    error: 0,
    warn: 0,
  }

  for (const v of violations) {
    counts[v.type]++
    severityCounts[v.severity]++
  }

  return {
    violations,
    counts,
    severityCounts,
    passed: severityCounts.error === 0,
  }
}
