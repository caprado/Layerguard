/**
 * Layerguard ESLint Plugin
 *
 * Provides ESLint rules for enforcing architectural boundaries defined
 * in layerguard configuration.
 *
 * Usage in eslint.config.js:
 *
 * ```js
 * import layerguard from 'layerguard/eslint'
 *
 * export default [
 *   {
 *     plugins: {
 *       layerguard,
 *     },
 *     rules: {
 *       'layerguard/layer-boundaries': 'error',
 *       'layerguard/unlayered-imports': 'warn',
 *     },
 *   },
 * ]
 * ```
 */

import type { ESLint, Linter } from 'eslint'
import layerBoundaries from './rules/layer-boundaries.js'
import unlayeredImports from './rules/unlayered-imports.js'

/**
 * Layerguard ESLint plugin
 */
const plugin: ESLint.Plugin = {
  meta: {
    name: 'layerguard',
    version: '0.1.1',
  },

  rules: {
    'layer-boundaries': layerBoundaries,
    'unlayered-imports': unlayeredImports,
  },

  configs: {
    /**
     * Recommended configuration
     *
     * Enables layer-boundaries as error
     *
     * Usage:
     * ```js
     * import layerguard from 'layerguard/eslint'
     * export default [layerguard.configs.recommended]
     * ```
     */
    get recommended(): Linter.Config {
      return {
        plugins: { layerguard: plugin },
        rules: {
          'layerguard/layer-boundaries': 'error',
        },
      }
    },

    /**
     * Strict configuration
     *
     * Enables all rules as errors
     *
     * Usage:
     * ```js
     * import layerguard from 'layerguard/eslint'
     * export default [layerguard.configs.strict]
     * ```
     */
    get strict(): Linter.Config {
      return {
        plugins: { layerguard: plugin },
        rules: {
          'layerguard/layer-boundaries': 'error',
          'layerguard/unlayered-imports': 'error',
        },
      }
    },
  },
}

export default plugin

// Named exports for convenience
export { layerBoundaries, unlayeredImports }
export { clearConfigCache, getCacheStats } from './config-cache.js'
export type { CachedConfig, LayerguardRuleOptions } from './types.js'
