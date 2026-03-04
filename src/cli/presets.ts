/**
 * Preset templates for common project structures
 */

import type { LayerguardConfig, LayerConfig, SublayerConfig } from '../config/types.js'

/**
 * Preset template
 */
export interface Preset {
  /**
   * Preset name for display
   */
  name: string

  /**
   * Short description
   */
  description: string

  /**
   * The layers configuration
   */
  layers: Record<string, LayerConfig>

  /**
   * The flow rules
   */
  flow: string[]

  /**
   * Optional framework setting
   */
  framework?: LayerguardConfig['framework']
}

/**
 * Next.js App Router preset
 */
export const nextjsAppPreset: Preset = {
  name: 'Next.js App Router',
  description: 'Standard Next.js 13+ App Router architecture',
  framework: 'nextjs-app',
  layers: {
    app: { path: 'app' },
    components: {
      path: 'components',
      sublayers: {
        features: { path: 'features', isolated: true },
        shared: { path: 'shared' },
      },
      flow: ['features -> shared'],
    },
    hooks: { path: 'hooks' },
    lib: { path: 'lib' },
    types: { path: 'types' },
  },
  flow: [
    'app -> components',
    'app -> hooks',
    'app -> lib',
    'components -> hooks',
    'components -> lib',
    'hooks -> lib',
    'lib -> types',
    'hooks -> types',
    'components -> types',
  ],
}

/**
 * Next.js App Router preset with src/ directory
 */
export const nextjsAppSrcPreset: Preset = {
  name: 'Next.js App Router (src/)',
  description: 'Next.js 13+ with src/ directory',
  framework: 'nextjs-app',
  layers: {
    app: { path: 'src/app' },
    components: {
      path: 'src/components',
      sublayers: {
        features: { path: 'features', isolated: true },
        shared: { path: 'shared' },
      },
      flow: ['features -> shared'],
    },
    hooks: { path: 'src/hooks' },
    lib: { path: 'src/lib' },
    types: { path: 'src/types' },
  },
  flow: [
    'app -> components',
    'app -> hooks',
    'app -> lib',
    'components -> hooks',
    'components -> lib',
    'hooks -> lib',
    'lib -> types',
    'hooks -> types',
    'components -> types',
  ],
}

/**
 * Next.js Pages Router preset
 */
export const nextjsPagesPreset: Preset = {
  name: 'Next.js Pages Router',
  description: 'Traditional Next.js Pages Router architecture',
  framework: 'nextjs-pages',
  layers: {
    pages: { path: 'pages' },
    components: {
      path: 'components',
      sublayers: {
        features: { path: 'features', isolated: true },
        shared: { path: 'shared' },
      },
      flow: ['features -> shared'],
    },
    hooks: { path: 'hooks' },
    lib: { path: 'lib' },
    types: { path: 'types' },
  },
  flow: [
    'pages -> components',
    'pages -> hooks',
    'pages -> lib',
    'components -> hooks',
    'components -> lib',
    'hooks -> lib',
    'lib -> types',
    'hooks -> types',
    'components -> types',
  ],
}

/**
 * Vite + React preset
 */
export const viteReactPreset: Preset = {
  name: 'Vite + React',
  description: 'Standard Vite React application',
  framework: 'vite-react',
  layers: {
    pages: { path: 'src/pages' },
    components: {
      path: 'src/components',
      sublayers: {
        features: { path: 'features', isolated: true },
        shared: { path: 'shared' },
      },
      flow: ['features -> shared'],
    },
    hooks: { path: 'src/hooks' },
    utils: { path: 'src/utils' },
    types: { path: 'src/types' },
  },
  flow: [
    'pages -> components',
    'pages -> hooks',
    'pages -> utils',
    'components -> hooks',
    'components -> utils',
    'hooks -> utils',
    'utils -> types',
    'hooks -> types',
    'components -> types',
  ],
}

/**
 * Generic layered preset (no framework)
 */
export const genericLayeredPreset: Preset = {
  name: 'Generic Layered',
  description: 'Framework-agnostic layered architecture',
  layers: {
    components: { path: 'src/components' },
    hooks: { path: 'src/hooks' },
    services: { path: 'src/services' },
    utils: { path: 'src/utils' },
    types: { path: 'src/types' },
  },
  flow: [
    'components -> hooks',
    'components -> services',
    'components -> utils',
    'hooks -> services',
    'hooks -> utils',
    'services -> utils',
    'utils -> types',
    'services -> types',
    'hooks -> types',
    'components -> types',
  ],
}

/**
 * Node.js backend preset
 */
export const nodeBackendPreset: Preset = {
  name: 'Node.js Backend',
  description: 'Node.js backend with controllers/services pattern',
  layers: {
    routes: { path: 'src/routes' },
    controllers: { path: 'src/controllers' },
    services: { path: 'src/services' },
    models: { path: 'src/models' },
    middleware: { path: 'src/middleware' },
    utils: { path: 'src/utils' },
    types: { path: 'src/types' },
  },
  flow: [
    'routes -> controllers',
    'routes -> middleware',
    'controllers -> services',
    'controllers -> utils',
    'services -> models',
    'services -> utils',
    'middleware -> utils',
    'models -> types',
    'services -> types',
    'controllers -> types',
    'utils -> types',
  ],
}

/**
 * Get all available presets
 */
export function getAllPresets(): Preset[] {
  return [
    nextjsAppPreset,
    nextjsAppSrcPreset,
    nextjsPagesPreset,
    viteReactPreset,
    genericLayeredPreset,
    nodeBackendPreset,
  ]
}

/**
 * Get a preset by framework detection
 */
export function getPresetByFramework(
  framework: string,
  hasSrcDir: boolean
): Preset | undefined {
  switch (framework) {
    case 'nextjs-app':
      return hasSrcDir ? nextjsAppSrcPreset : nextjsAppPreset
    case 'nextjs-pages':
      return nextjsPagesPreset
    case 'vite-react':
      return viteReactPreset
    case 'node':
      return nodeBackendPreset
    default:
      return genericLayeredPreset
  }
}

/**
 * Create a custom config from selected layers
 */
export function createCustomConfig(
  layers: Array<{
    name: string
    path: string
    sublayers?: Array<{ name: string; path: string; isolated?: boolean }>
  }>,
  flowRules: string[],
  framework?: LayerguardConfig['framework']
): LayerguardConfig {
  const layersConfig: Record<string, LayerConfig> = {}

  for (const layer of layers) {
    const config: LayerConfig = { path: layer.path }

    if (layer.sublayers && layer.sublayers.length > 0) {
      config.sublayers = {}
      for (const sub of layer.sublayers) {
        const sublayerConfig: SublayerConfig = {
          path: sub.path,
        }
        if (sub.isolated) {
          sublayerConfig.isolated = true
        }
        config.sublayers[sub.name] = sublayerConfig
      }
    }

    layersConfig[layer.name] = config
  }

  const config: LayerguardConfig = {
    layers: layersConfig,
    flow: flowRules,
  }

  if (framework) {
    config.framework = framework
  }

  return config
}
