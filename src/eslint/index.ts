/**
 * Archgate ESLint Plugin
 *
 * Provides ESLint rules for enforcing architectural boundaries defined
 * in archgate configuration.
 *
 * Usage in eslint.config.js:
 *
 * ```js
 * import archgate from 'archgate/eslint'
 *
 * export default [
 *   {
 *     plugins: {
 *       archgate,
 *     },
 *     rules: {
 *       'archgate/layer-boundaries': 'error',
 *       'archgate/unlayered-imports': 'warn',
 *     },
 *   },
 * ]
 * ```
 */

import type { ESLint, Linter } from 'eslint'
import layerBoundaries from './rules/layer-boundaries.js'
import unlayeredImports from './rules/unlayered-imports.js'

/**
 * Archgate ESLint plugin
 */
const plugin: ESLint.Plugin = {
  meta: {
    name: 'archgate',
    version: '0.1.0',
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
     * import archgate from 'archgate/eslint'
     * export default [archgate.configs.recommended]
     * ```
     */
    get recommended(): Linter.Config {
      return {
        plugins: { archgate: plugin },
        rules: {
          'archgate/layer-boundaries': 'error',
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
     * import archgate from 'archgate/eslint'
     * export default [archgate.configs.strict]
     * ```
     */
    get strict(): Linter.Config {
      return {
        plugins: { archgate: plugin },
        rules: {
          'archgate/layer-boundaries': 'error',
          'archgate/unlayered-imports': 'error',
        },
      }
    },
  },
}

export default plugin

// Named exports for convenience
export { layerBoundaries, unlayeredImports }
export { clearConfigCache, getCacheStats } from './config-cache.js'
export type { CachedConfig, ArchgateRuleOptions } from './types.js'
