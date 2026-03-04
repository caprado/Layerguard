import { describe, it, expect } from 'vitest'
import {
  getAllPresets,
  getPresetByFramework,
  createCustomConfig,
  nextjsAppPreset,
  nextjsAppSrcPreset,
  nextjsPagesPreset,
  viteReactPreset,
  genericLayeredPreset,
  nodeBackendPreset,
} from '../../../src/cli/presets.js'

describe('getAllPresets', () => {
  it('returns all available presets', () => {
    const presets = getAllPresets()

    expect(presets.length).toBeGreaterThan(0)
    expect(presets.some((p) => p.name === 'Next.js App Router')).toBe(true)
    expect(presets.some((p) => p.name === 'Generic Layered')).toBe(true)
  })

  it('all presets have required fields', () => {
    const presets = getAllPresets()

    for (const preset of presets) {
      expect(preset.name).toBeDefined()
      expect(preset.description).toBeDefined()
      expect(preset.layers).toBeDefined()
      expect(preset.flow).toBeDefined()
      expect(Object.keys(preset.layers).length).toBeGreaterThan(0)
      expect(preset.flow.length).toBeGreaterThan(0)
    }
  })
})

describe('getPresetByFramework', () => {
  it('returns Next.js App Router preset for nextjs-app', () => {
    const preset = getPresetByFramework('nextjs-app', false)

    expect(preset).toBe(nextjsAppPreset)
  })

  it('returns Next.js App Router with src preset when hasSrcDir is true', () => {
    const preset = getPresetByFramework('nextjs-app', true)

    expect(preset).toBe(nextjsAppSrcPreset)
  })

  it('returns Next.js Pages Router preset for nextjs-pages', () => {
    const preset = getPresetByFramework('nextjs-pages', false)

    expect(preset).toBe(nextjsPagesPreset)
  })

  it('returns Vite React preset for vite-react', () => {
    const preset = getPresetByFramework('vite-react', false)

    expect(preset).toBe(viteReactPreset)
  })

  it('returns Node backend preset for node', () => {
    const preset = getPresetByFramework('node', false)

    expect(preset).toBe(nodeBackendPreset)
  })

  it('returns generic preset for unknown framework', () => {
    const preset = getPresetByFramework('unknown', false)

    expect(preset).toBe(genericLayeredPreset)
  })
})

describe('createCustomConfig', () => {
  it('creates config from layers and flow rules', () => {
    const config = createCustomConfig(
      [
        { name: 'components', path: 'src/components' },
        { name: 'hooks', path: 'src/hooks' },
      ],
      ['components -> hooks']
    )

    expect(config.layers.components!.path).toBe('src/components')
    expect(config.layers.hooks!.path).toBe('src/hooks')
    expect(config.flow).toContain('components -> hooks')
  })

  it('creates config with sublayers', () => {
    const config = createCustomConfig(
      [
        {
          name: 'components',
          path: 'src/components',
          sublayers: [
            { name: 'features', path: 'features', isolated: true },
            { name: 'shared', path: 'shared' },
          ],
        },
      ],
      []
    )

    expect(config.layers.components!.sublayers!.features!.path).toBe('features')
    expect(config.layers.components!.sublayers!.features!.isolated).toBe(true)
    expect(config.layers.components!.sublayers!.shared!.path).toBe('shared')
    expect(config.layers.components!.sublayers!.shared!.isolated).toBeUndefined()
  })

  it('includes framework when provided', () => {
    const config = createCustomConfig(
      [{ name: 'components', path: 'src/components' }],
      [],
      'nextjs-app'
    )

    expect(config.framework).toBe('nextjs-app')
  })

  it('excludes framework when not provided', () => {
    const config = createCustomConfig(
      [{ name: 'components', path: 'src/components' }],
      []
    )

    expect(config.framework).toBeUndefined()
  })
})

describe('nextjsAppPreset', () => {
  it('has nextjs-app framework', () => {
    expect(nextjsAppPreset.framework).toBe('nextjs-app')
  })

  it('includes app layer', () => {
    expect(nextjsAppPreset.layers.app).toBeDefined()
    expect(nextjsAppPreset.layers.app!.path).toBe('app')
  })

  it('includes components layer with sublayers', () => {
    expect(nextjsAppPreset.layers.components).toBeDefined()
    expect(nextjsAppPreset.layers.components!.sublayers).toBeDefined()
    expect(nextjsAppPreset.layers.components!.sublayers!.features!.isolated).toBe(true)
  })

  it('has valid flow rules', () => {
    expect(nextjsAppPreset.flow).toContain('app -> components')
    expect(nextjsAppPreset.flow).toContain('components -> hooks')
  })
})

describe('nodeBackendPreset', () => {
  it('has no framework set', () => {
    expect(nodeBackendPreset.framework).toBeUndefined()
  })

  it('includes backend-specific layers', () => {
    expect(nodeBackendPreset.layers.routes).toBeDefined()
    expect(nodeBackendPreset.layers.controllers).toBeDefined()
    expect(nodeBackendPreset.layers.services).toBeDefined()
    expect(nodeBackendPreset.layers.models).toBeDefined()
    expect(nodeBackendPreset.layers.middleware).toBeDefined()
  })

  it('has valid backend flow rules', () => {
    expect(nodeBackendPreset.flow).toContain('routes -> controllers')
    expect(nodeBackendPreset.flow).toContain('controllers -> services')
    expect(nodeBackendPreset.flow).toContain('services -> models')
  })
})

describe('genericLayeredPreset', () => {
  it('has no framework set', () => {
    expect(genericLayeredPreset.framework).toBeUndefined()
  })

  it('uses src/ prefix for paths', () => {
    expect(genericLayeredPreset.layers.components!.path).toBe('src/components')
    expect(genericLayeredPreset.layers.hooks!.path).toBe('src/hooks')
  })
})
