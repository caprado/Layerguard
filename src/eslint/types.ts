/**
 * ESLint plugin types
 */

import type { Rule } from 'eslint'
import type { LayerguardConfig } from '../config/types.js'

/**
 * Cached layerguard configuration for ESLint
 */
export interface CachedConfig {
  /**
   * The loaded layerguard configuration
   */
  config: LayerguardConfig

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
 * ESLint rule context with layerguard extensions
 */
export interface LayerguardRuleContext extends Rule.RuleContext {
  /**
   * Get the layerguard configuration
   */
  getLayerguardConfig?: () => CachedConfig | null
}

/**
 * Rule options for layerguard ESLint rules
 */
export interface LayerguardRuleOptions {
  /**
   * Path to layerguard config file (optional, auto-detected if not specified)
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
