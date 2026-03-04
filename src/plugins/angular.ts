/**
 * Angular plugin
 *
 * Handles Angular-specific conventions including modules, components,
 * services, guards, pipes, and lazy-loaded routes
 */

import type { FrameworkPlugin } from './types.js'

/**
 * Angular file suffixes that indicate implicitly used files
 */
const ANGULAR_SUFFIXES = [
  '.component.ts',
  '.component.js',
  '.module.ts',
  '.module.js',
  '.service.ts',
  '.service.js',
  '.guard.ts',
  '.guard.js',
  '.pipe.ts',
  '.pipe.js',
  '.directive.ts',
  '.directive.js',
  '.interceptor.ts',
  '.interceptor.js',
  '.resolver.ts',
  '.resolver.js',
]

/**
 * Angular spec/test file suffixes to ignore
 */
const SPEC_SUFFIXES = [
  '.spec.ts',
  '.spec.js',
  '.test.ts',
  '.test.js',
]

/**
 * Angular plugin
 */
export const angularPlugin: FrameworkPlugin = {
  name: 'Angular',
  framework: 'angular',

  defaultIgnorePatterns: [
    'dist/**',
    '.angular/**',
    'node_modules/**',
    '**/*.spec.ts',
    '**/*.spec.js',
    'e2e/**',
    'coverage/**',
  ],

  isImplicitlyUsed(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')

    // Angular CLI entry points
    if (
      normalized === 'src/main.ts' ||
      normalized === 'src/main.js' ||
      normalized === 'src/polyfills.ts' ||
      normalized === 'src/polyfills.js'
    ) {
      return true
    }

    // Angular configuration files
    if (
      normalized === 'angular.json' ||
      normalized === '.angular.json' ||
      normalized === 'angular-cli.json'
    ) {
      return true
    }

    // index.html
    if (normalized === 'src/index.html') {
      return true
    }

    // App module/component (bootstrap)
    if (
      normalized === 'src/app/app.module.ts' ||
      normalized === 'src/app/app.component.ts' ||
      normalized === 'src/app/app.config.ts' ||
      normalized === 'src/app/app.routes.ts'
    ) {
      return true
    }

    // Environment files
    if (normalized.includes('/environments/')) {
      return true
    }

    // Angular files with standard suffixes are used via DI/decorators
    for (const suffix of ANGULAR_SUFFIXES) {
      if (normalized.endsWith(suffix)) {
        return true
      }
    }

    // Routing modules
    if (normalized.endsWith('-routing.module.ts') || normalized.endsWith('-routing.module.js')) {
      return true
    }

    // Assets
    if (normalized.startsWith('src/assets/')) {
      return true
    }

    // Styles
    if (
      normalized === 'src/styles.css' ||
      normalized === 'src/styles.scss' ||
      normalized === 'src/styles.sass' ||
      normalized === 'src/styles.less'
    ) {
      return true
    }

    return false
  },

  shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    const segments = normalized.split('/')

    // Ignore dist directory
    if (segments[0] === 'dist') return true

    // Ignore .angular cache
    if (segments[0] === '.angular') return true

    // Ignore e2e tests
    if (segments[0] === 'e2e') return true

    // Ignore coverage
    if (segments[0] === 'coverage') return true

    // Ignore spec files
    for (const suffix of SPEC_SUFFIXES) {
      if (normalized.endsWith(suffix)) {
        return true
      }
    }

    return false
  },

  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/')
  },
}

export default angularPlugin
