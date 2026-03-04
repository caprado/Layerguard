/**
 * Vue / Nuxt plugin
 *
 * Handles Vue.js and Nuxt.js specific conventions
 */

import type { FrameworkPlugin } from './types.js'

/**
 * Nuxt auto-import directories
 */
const NUXT_AUTO_IMPORT_DIRS = [
  'components',
  'composables',
  'utils',
  'server',
  'middleware',
  'plugins',
  'layouts',
  'pages',
]

/**
 * Vue / Nuxt plugin
 */
export const vueNuxtPlugin: FrameworkPlugin = {
  name: 'Vue / Nuxt',
  framework: 'vue-nuxt',

  defaultIgnorePatterns: [
    'dist/**',
    '.nuxt/**',
    '.output/**',
    'node_modules/**',
    '.vite/**',
  ],

  isImplicitlyUsed(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    const segments = normalized.split('/')

    // Vue entry points
    if (
      normalized === 'src/main.ts' ||
      normalized === 'src/main.js' ||
      normalized === 'src/App.vue' ||
      normalized === 'app.vue' ||
      normalized === 'App.vue'
    ) {
      return true
    }

    // Nuxt configuration
    if (
      normalized === 'nuxt.config.ts' ||
      normalized === 'nuxt.config.js'
    ) {
      return true
    }

    // Vite configuration
    if (
      normalized === 'vite.config.ts' ||
      normalized === 'vite.config.js'
    ) {
      return true
    }

    // Vue config
    if (
      normalized === 'vue.config.js' ||
      normalized === 'vue.config.ts'
    ) {
      return true
    }

    // index.html
    if (normalized === 'index.html' || normalized === 'public/index.html') {
      return true
    }

    // .vue files are always implicitly used (they're components)
    if (normalized.endsWith('.vue')) {
      return true
    }

    // Nuxt pages directory (file-based routing)
    if (segments[0] === 'pages' || (segments[0] === 'src' && segments[1] === 'pages')) {
      return true
    }

    // Nuxt auto-import directories
    for (const dir of NUXT_AUTO_IMPORT_DIRS) {
      if (segments[0] === dir || (segments[0] === 'src' && segments[1] === dir)) {
        return true
      }
    }

    // Nuxt server directory
    if (segments[0] === 'server') {
      return true
    }

    // App config
    if (normalized === 'app.config.ts' || normalized === 'app.config.js') {
      return true
    }

    // Error pages
    if (normalized === 'error.vue' || normalized === 'pages/error.vue') {
      return true
    }

    return false
  },

  shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    const segments = normalized.split('/')

    // Ignore dist directory
    if (segments[0] === 'dist') return true

    // Ignore .nuxt directory (generated)
    if (segments[0] === '.nuxt') return true

    // Ignore .output directory (Nuxt build output)
    if (segments[0] === '.output') return true

    // Ignore .vite cache
    if (segments[0] === '.vite') return true

    return false
  },

  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/')
  },
}

export default vueNuxtPlugin
