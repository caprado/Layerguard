/**
 * Archgate Configuration Types
 *
 * These types define the structure of archgate.config.ts files.
 */

/**
 * Main configuration interface for Archgate
 */
export interface ArchgateConfig {
  /**
   * Optional framework identifier for framework-specific intelligence.
   * Enables features like orphan detection and special file handling.
   * Core layer/flow enforcement works without this.
   */
  framework?:
    | 'nextjs-app'
    | 'nextjs-pages'
    | 'vite-react'
    | 'vite-react-router'
    | 'vite-tanstack-router'
    | 'node-backend'
    | 'vue-nuxt'
    | 'angular'
    | 'custom'

  /**
   * Layer definitions mapping layer names to their configuration.
   * Each layer represents an architectural tier (e.g., pages, components, hooks).
   */
  layers: Record<string, LayerConfig>

  /**
   * Flow rules defining allowed dependency directions between layers.
   * Format: 'A -> B' (unidirectional) or 'A <-> B' (bidirectional)
   */
  flow: string[]

  /**
   * Optional rules for additional checks
   */
  rules?: RulesConfig

  /**
   * Glob patterns to exclude from analysis
   */
  ignore?: string[]

  /**
   * Documented exceptions to flow rules
   */
  exceptions?: Exception[]

  /**
   * Path(s) to tsconfig.json file(s).
   * - If not specified, auto-detects tsconfig.json in project root
   * - Can be a single path: 'tsconfig.app.json'
   * - Can be multiple paths: ['tsconfig.app.json', 'tsconfig.server.json']
   * - Multiple tsconfigs are merged (union of source files and path mappings)
   */
  tsconfig?: string | string[]
}

/**
 * Configuration for a single layer
 */
export interface LayerConfig {
  /**
   * Path to the layer directory, relative to project root
   */
  path: string

  /**
   * Optional sublayer definitions for internal organization
   */
  sublayers?: Record<string, SublayerConfig>

  /**
   * Internal flow rules between sublayers within this layer
   */
  flow?: string[]

  /**
   * Public API file(s) for this layer.
   * When specified, only these files can be imported from outside the layer.
   * Other files within the layer become private to the layer.
   * Can be a single file: 'index.ts'
   * Or multiple files: ['index.ts', 'types.ts']
   */
  publicApi?: string | string[]

  /**
   * Maximum number of other layers that can import from this layer.
   * When exceeded, produces a warning about the layer becoming a "god layer".
   * Useful for preventing utility layers from becoming too central.
   */
  maxDependents?: number
}

/**
 * Configuration for a sublayer within a parent layer
 */
export interface SublayerConfig {
  /**
   * Path to the sublayer directory, relative to project root
   */
  path: string

  /**
   * If true, sibling directories within this sublayer cannot import from each other.
   * Used for feature isolation (e.g., features/calendar cannot import from features/build)
   */
  isolated?: boolean
}

/**
 * Additional rule configuration
 */
export interface RulesConfig {
  /**
   * How to handle circular dependencies
   * @default 'error'
   */
  circular?: 'error' | 'warn' | 'off'

  /**
   * How to handle orphaned files (files not imported anywhere)
   * @default 'off'
   */
  orphans?: 'error' | 'warn' | 'off'

  /**
   * Whether to enforce rules on type-only imports
   * @default 'ignore'
   */
  typeOnlyImports?: 'enforce' | 'ignore'

  /**
   * How to handle imports from layered files to unlayered files.
   * - 'ignore' (default): unlayered imports are not checked
   * - 'warn': unlayered imports produce warnings but don't fail the build
   * - 'error': unlayered imports are violations
   * @default 'ignore'
   */
  unlayeredImports?: 'error' | 'warn' | 'ignore'

  /**
   * How to resolve import targets when checking layer boundaries.
   * - 'import-site' (default): check against where the import statement points
   *   (e.g., importing from services/index.ts counts as importing from services)
   * - 'origin': trace re-exports to their origin file and check against that
   *   (e.g., if services/index.ts re-exports from repository/users.ts,
   *   the checked edge becomes handlers → repository)
   * @default 'import-site'
   */
  barrelResolution?: 'import-site' | 'origin'

  /**
   * How to handle imports from workspace packages (e.g., @myorg/shared).
   * - 'ignore' (default): treat workspace package imports as external (like node_modules)
   * - 'enforce': resolve into target package's source and apply cross-package layer rules
   * @default 'ignore'
   */
  workspaceImports?: 'enforce' | 'ignore'

  /**
   * Maximum allowed depth of import chains (transitive imports).
   * E.g., maxImportDepth: 3 means A -> B -> C is fine, but A -> B -> C -> D triggers a warning.
   * Prevents deep transitive coupling even when each individual edge is allowed.
   */
  maxImportDepth?: number

  /**
   * Maximum number of imports allowed per file.
   * High import counts may signal a file is doing too much or has too many dependencies.
   * When exceeded, produces a warning.
   */
  maxImportsPerFile?: number
}

/**
 * A documented exception to the flow rules
 */
export interface Exception {
  /**
   * Glob pattern for the source file(s)
   */
  from: string

  /**
   * Glob pattern for the target file(s)
   */
  to: string

  /**
   * Required explanation for why this exception exists
   */
  reason: string
}

/**
 * Parsed flow rule representation
 */
export interface ParsedFlowRule {
  from: string
  to: string
  direction: 'unidirectional' | 'bidirectional'
}

/**
 * Directed graph representation of flow rules
 * Maps layer names to sets of layers they can import from
 */
export type FlowGraph = Map<string, Set<string>>

/**
 * Helper function for type-safe config definition
 */
export function defineConfig(config: ArchgateConfig): ArchgateConfig {
  return config
}
