/**
 * Plugin registry
 *
 * Maps framework names to their plugin implementations
 */

import type { FrameworkPlugin } from './types.js'
import { nextjsAppPlugin } from './nextjs-app.js'
import { nextjsPagesPlugin } from './nextjs-pages.js'
import { viteReactPlugin } from './vite-react.js'
import { viteReactRouterPlugin } from './vite-react-router.js'
import { viteTanstackRouterPlugin } from './vite-tanstack-router.js'
import { nodeBackendPlugin } from './node-backend.js'
import { vueNuxtPlugin } from './vue-nuxt.js'
import { angularPlugin } from './angular.js'

/**
 * Registry of all available plugins
 */
const pluginRegistry = new Map<string, FrameworkPlugin>([
  ['nextjs-app', nextjsAppPlugin],
  ['nextjs-pages', nextjsPagesPlugin],
  ['vite-react', viteReactPlugin],
  ['vite-react-router', viteReactRouterPlugin],
  ['vite-tanstack-router', viteTanstackRouterPlugin],
  ['node-backend', nodeBackendPlugin],
  ['vue-nuxt', vueNuxtPlugin],
  ['angular', angularPlugin],
])

/**
 * Get a plugin by framework name
 *
 * @param framework - The framework identifier from config
 * @returns The plugin or undefined if not found
 */
export function getPlugin(framework: string): FrameworkPlugin | undefined {
  return pluginRegistry.get(framework)
}

/**
 * Get all available plugins
 *
 * @returns Array of all registered plugins
 */
export function getAllPlugins(): FrameworkPlugin[] {
  return Array.from(pluginRegistry.values())
}

/**
 * Get all available framework names
 *
 * @returns Array of framework identifiers
 */
export function getAvailableFrameworks(): string[] {
  return Array.from(pluginRegistry.keys())
}

/**
 * Check if a framework has a plugin
 *
 * @param framework - The framework identifier
 * @returns true if a plugin exists
 */
export function hasPlugin(framework: string): boolean {
  return pluginRegistry.has(framework)
}

/**
 * Register a custom plugin
 *
 * This allows users to add custom framework plugins.
 *
 * @param plugin - The plugin to register
 */
export function registerPlugin(plugin: FrameworkPlugin): void {
  pluginRegistry.set(plugin.framework, plugin)
}

/**
 * Create a no-op plugin
 *
 * Used when no framework is specified in config.
 * All methods return false/undefined, so the core engine works unchanged.
 */
export function createNoopPlugin(): FrameworkPlugin {
  return {
    name: 'No Framework',
    framework: 'custom',
    isImplicitlyUsed: () => false,
    shouldIgnore: () => false,
    defaultIgnorePatterns: [],
  }
}
