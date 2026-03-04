/**
 * Archgate - Framework-agnostic architectural layer enforcement
 *
 * Public API for programmatic use
 */

// Config types and helpers
export {
  defineConfig,
  type ArchgateConfig,
  type LayerConfig,
  type SublayerConfig,
  type RulesConfig,
  type Exception,
  type ParsedFlowRule,
  type FlowGraph,
} from './config/types.js'

// Config loading
export {
  loadConfig,
  findConfigFile,
  ConfigNotFoundError,
  ConfigLoadError,
  type LoadConfigResult,
} from './config/loader.js'

// Flow parsing
export {
  parseFlowRule,
  parseFlowRules,
  buildFlowGraph,
  canImport,
  findIsolatedLayers,
  FlowParseError,
} from './config/parser.js'

// Config validation
export {
  validateConfig,
  type ValidationError,
  type ValidationResult,
} from './config/validator.js'

// File scanning
export {
  scanDirectory,
  getRelativePath,
  DEFAULT_IGNORE_PATTERNS,
  type ScanOptions,
  type ScanResult,
} from './parser/scanner.js'

// Import extraction
export {
  extractImports,
  extractImportsFromFiles,
  isExternalImport,
  isRelativeImport,
  type ImportInfo,
  type ImportKind,
  type ExtractionResult,
  type ExtractOptions,
} from './parser/extractor.js'

// Import resolution
export {
  createResolverContext,
  resolveImport,
  resolveImports,
  isExternalSpecifier,
  toRelativePath,
  type ResolvedImport,
} from './parser/resolver.js'

// Dependency graph
export {
  buildDependencyGraph,
  getDependencies,
  getDependents,
  getEdgesBetween,
  hasDependency,
  getGraphStats,
  type DependencyGraph,
  type DependencyEdge,
  type BuildGraphOptions,
} from './parser/graph.js'

// Violations
export {
  createFlowViolation,
  createIsolationViolation,
  createCircularViolation,
  createUnmappedViolation,
  createViolationReport,
  type Violation,
  type ViolationType,
  type ViolationSeverity,
  type FlowViolation,
  type IsolationViolation,
  type CircularViolation,
  type UnmappedViolation,
  type ViolationReport,
} from './enforcer/violations.js'

// Layer mapping
export {
  LayerMapper,
  createLayerMapper,
  type LayerMapping,
} from './enforcer/mapper.js'

// Flow checking
export {
  FlowChecker,
  createFlowChecker,
  checkDependencyGraph,
  type CheckOptions,
  type EdgeCheckResult,
} from './enforcer/checker.js'

// Circular dependency detection
export {
  detectCircularDependencies,
  findCyclePath,
  hasAnyCycle,
  type StronglyConnectedComponent,
  type CircularDetectionResult,
} from './enforcer/circular.js'

// Terminal output
export {
  formatViolation,
  formatReport,
  formatSuccess,
  formatError,
  formatStats,
  type TerminalOptions,
} from './output/terminal.js'

// CI output
export {
  formatGitHubAnnotation,
  formatGitHubAnnotations,
  formatCIReport,
  isGitHubActions,
  isCI,
} from './output/ci.js'

// JSON output
export {
  violationToJson,
  reportToJson,
  formatJsonViolations,
  formatJsonReport,
  type JsonViolation,
  type JsonReport,
} from './output/json.js'

// Diagram output
export {
  generateDiagram,
  generateFlowSummary,
  type DiagramOptions,
} from './output/diagram.js'

// CLI commands
export { runCheck, type CheckCommandOptions, type CheckResult } from './cli/check.js'
export { runShow, type ShowCommandOptions } from './cli/show.js'
export { runInit, type InitCommandOptions } from './cli/init.js'

// Init utilities
export {
  detectFramework,
  scanForLayers,
  suggestFlowRules,
  shouldBeIsolated,
  COMMON_LAYER_PATTERNS,
  type DetectedFramework,
  type DetectionResult,
  type DirectoryInfo,
} from './cli/detect.js'

export {
  getAllPresets,
  getPresetByFramework,
  createCustomConfig,
  type Preset,
} from './cli/presets.js'

export {
  generateConfigContent,
  writeConfigFile,
  configFileExists,
  type GenerateOptions,
} from './cli/generator.js'
