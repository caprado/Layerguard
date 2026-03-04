/**
 * Framework plugin interface
 *
 * Plugins provide framework-specific intelligence for orphan detection
 * and special file handling. The core enforcement engine is framework-agnostic.
 */

/**
 * Framework plugin interface
 */
export interface FrameworkPlugin {
  /**
   * Plugin name for display
   */
  name: string

  /**
   * Framework identifier (matches config.framework)
   */
  framework: string

  /**
   * Check if a file is implicitly used by the framework
   *
   * Files that are "used" by the framework via conventions (e.g., filesystem routing)
   * should return true. These files won't be flagged as orphans.
   *
   * @param filePath - Relative path from project root
   * @returns true if the file is implicitly used
   */
  isImplicitlyUsed?(filePath: string): boolean

  /**
   * Check if a file should be ignored by the checker
   *
   * Generated files, build output, and framework internals should return true.
   *
   * @param filePath - Relative path from project root
   * @returns true if the file should be ignored
   */
  shouldIgnore?(filePath: string): boolean

  /**
   * Default ignore patterns for this framework
   *
   * These are added to the config.ignore patterns when this plugin is active.
   */
  defaultIgnorePatterns?: string[]

  /**
   * Check if a path segment is a route group (should be ignored in layer matching)
   *
   * For Next.js App Router, route groups like (auth) or (marketing) are organizational
   * and should not affect layer matching.
   *
   * @param segment - A single path segment
   * @returns true if this is a route group
   */
  isRouteGroup?(segment: string): boolean

  /**
   * Normalize a file path by removing framework-specific segments
   *
   * This is used to get a clean path for layer matching.
   * For example, app/(auth)/login/page.tsx -> app/login/page.tsx
   *
   * @param filePath - Relative path from project root
   * @returns Normalized path
   */
  normalizePath?(filePath: string): string
}

/**
 * Plugin context provided to plugins
 */
export interface PluginContext {
  /**
   * Project root directory
   */
  projectRoot: string

  /**
   * Whether the project uses TypeScript
   */
  isTypeScript: boolean
}

/**
 * Result of checking if a file is implicitly used
 */
export interface ImplicitUseResult {
  /**
   * Whether the file is implicitly used
   */
  isUsed: boolean

  /**
   * Reason why the file is considered used (for debugging)
   */
  reason?: string
}
