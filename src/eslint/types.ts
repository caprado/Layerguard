/**
 * ESLint plugin types
 */

import type { Rule } from 'eslint'
import type { ArchgateConfig } from '../config/types.js'

/**
 * Cached archgate configuration for ESLint
 */
export interface CachedConfig {
  /**
   * The loaded archgate configuration
   */
  config: ArchgateConfig

  /**
   * Path to the config file
   */
  configPath: string

  /**
   * Project root directory
   */
  projectRoot: string

  /**
   * Timestamp when the config was loaded
   */
  loadedAt: number
}

/**
 * ESLint rule context with archgate extensions
 */
export interface ArchgateRuleContext extends Rule.RuleContext {
  /**
   * Get the archgate configuration
   */
  getArchgateConfig?: () => CachedConfig | null
}

/**
 * Rule options for archgate ESLint rules
 */
export interface ArchgateRuleOptions {
  /**
   * Path to archgate config file (optional, auto-detected if not specified)
   */
  configPath?: string
}

/**
 * Import node information
 */
export interface ImportInfo {
  /**
   * The import specifier (e.g., '../services/user')
   */
  specifier: string

  /**
   * Source file path (absolute)
   */
  sourceFile: string

  /**
   * Line number of the import
   */
  line: number

  /**
   * Column number of the import
   */
  column: number
}
