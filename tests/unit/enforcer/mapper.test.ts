import { describe, it, expect } from 'vitest'
import { LayerMapper, createLayerMapper } from '../../../src/enforcer/mapper.js'
import type { LayerguardConfig } from '../../../src/config/types.js'

describe('LayerMapper', () => {
  const basicConfig: LayerguardConfig = {
    layers: {
      components: { path: 'src/components' },
      hooks: { path: 'src/hooks' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> hooks', 'hooks -> utils'],
  }

  const configWithSublayers: LayerguardConfig = {
    layers: {
      components: {
        path: 'src/components',
        sublayers: {
          features: { path: 'src/components/features', isolated: true },
          shared: { path: 'src/components/shared' },
          app: { path: 'src/components/app' },
        },
        flow: ['app -> features', 'features -> shared'],
      },
      hooks: { path: 'src/hooks' },
    },
    flow: ['components -> hooks'],
  }

  describe('basic layer mapping', () => {
    it('maps file to correct layer', () => {
      const mapper = createLayerMapper(basicConfig)

      const result = mapper.map('src/components/Button.tsx')

      expect(result).not.toBeNull()
      expect(result?.layer).toBe('components')
      expect(result?.sublayer).toBeUndefined()
      expect(result?.isIsolated).toBe(false)
    })

    it('maps file in nested directory', () => {
      const mapper = createLayerMapper(basicConfig)

      const result = mapper.map('src/hooks/api/useFetch.ts')

      expect(result?.layer).toBe('hooks')
    })

    it('returns null for unmapped file', () => {
      const mapper = createLayerMapper(basicConfig)

      const result = mapper.map('src/other/file.ts')

      expect(result).toBeNull()
    })

    it('handles file directly in layer root', () => {
      const mapper = createLayerMapper(basicConfig)

      const result = mapper.map('src/utils/index.ts')

      expect(result?.layer).toBe('utils')
    })

    it('handles normalized paths', () => {
      const mapper = createLayerMapper(basicConfig)

      // Windows-style path
      const result = mapper.map('src\\components\\Button.tsx')

      expect(result?.layer).toBe('components')
    })
  })

  describe('sublayer mapping', () => {
    it('maps file to sublayer', () => {
      const mapper = createLayerMapper(configWithSublayers)

      const result = mapper.map('src/components/features/calendar/Calendar.tsx')

      expect(result?.layer).toBe('components')
      expect(result?.sublayer).toBe('features')
      expect(result?.isIsolated).toBe(true)
    })

    it('extracts feature from isolated sublayer', () => {
      const mapper = createLayerMapper(configWithSublayers)

      const result = mapper.map('src/components/features/calendar/CalendarView.tsx')

      expect(result?.feature).toBe('calendar')
    })

    it('extracts feature from deeply nested path', () => {
      const mapper = createLayerMapper(configWithSublayers)

      const result = mapper.map('src/components/features/calendar/components/Day.tsx')

      expect(result?.feature).toBe('calendar')
    })

    it('does not extract feature for non-isolated sublayer', () => {
      const mapper = createLayerMapper(configWithSublayers)

      const result = mapper.map('src/components/shared/Button.tsx')

      expect(result?.sublayer).toBe('shared')
      expect(result?.feature).toBeUndefined()
      expect(result?.isIsolated).toBe(false)
    })

    it('maps file directly in sublayer (no feature)', () => {
      const mapper = createLayerMapper(configWithSublayers)

      const result = mapper.map('src/components/features/index.ts')

      expect(result?.sublayer).toBe('features')
      expect(result?.feature).toBeUndefined()
    })

    it('maps file in layer but not in sublayer', () => {
      const mapper = createLayerMapper(configWithSublayers)

      const result = mapper.map('src/components/index.ts')

      expect(result?.layer).toBe('components')
      expect(result?.sublayer).toBeUndefined()
    })
  })

  describe('most specific matching (path overlap resolution)', () => {
    it('matches most specific layer path', () => {
      const config: LayerguardConfig = {
        layers: {
          src: { path: 'src' },
          components: { path: 'src/components' },
        },
        flow: [],
      }
      const mapper = createLayerMapper(config)

      const result = mapper.map('src/components/Button.tsx')

      // Should match components (more specific) not src
      expect(result?.layer).toBe('components')
    })

    it('matches most specific sublayer path', () => {
      const config: LayerguardConfig = {
        layers: {
          components: {
            path: 'src/components',
            sublayers: {
              features: { path: 'src/components/features' },
              calendar: { path: 'src/components/features/calendar' },
            },
          },
        },
        flow: [],
      }
      const mapper = createLayerMapper(config)

      const result = mapper.map('src/components/features/calendar/Day.tsx')

      // Should match calendar (more specific)
      expect(result?.sublayer).toBe('calendar')
    })

    it('does not match layer with similar but different path prefix', () => {
      // Example from spec: src/components/shared/utils/ should NOT match utils layer
      const config: LayerguardConfig = {
        layers: {
          utils: { path: 'src/utils' },
          components: {
            path: 'src/components',
            sublayers: {
              shared: { path: 'src/components/shared' },
            },
          },
        },
        flow: [],
      }
      const mapper = createLayerMapper(config)

      // This file is in src/components/shared/utils, NOT src/utils
      const result = mapper.map('src/components/shared/utils/helper.ts')

      expect(result?.layer).toBe('components')
      expect(result?.sublayer).toBe('shared')
    })

    it('matches parent layer when file is not in any sublayer', () => {
      const config: LayerguardConfig = {
        layers: {
          components: {
            path: 'src/components',
            sublayers: {
              shared: { path: 'src/components/shared' },
            },
          },
        },
        flow: [],
      }
      const mapper = createLayerMapper(config)

      // This file is in components but NOT in the shared sublayer
      const result = mapper.map('src/components/Button.tsx')

      expect(result?.layer).toBe('components')
      expect(result?.sublayer).toBeUndefined()
    })

    it('handles trailing slash in config path', () => {
      const config: LayerguardConfig = {
        layers: {
          components: { path: 'src/components/' }, // trailing slash
        },
        flow: [],
      }
      const mapper = createLayerMapper(config)

      const result = mapper.map('src/components/Button.tsx')

      expect(result?.layer).toBe('components')
    })

    it('handles leading slash in config path', () => {
      const config: LayerguardConfig = {
        layers: {
          components: { path: '/src/components' }, // leading slash
        },
        flow: [],
      }
      const mapper = createLayerMapper(config)

      const result = mapper.map('src/components/Button.tsx')

      expect(result?.layer).toBe('components')
    })

    it('normalizes Windows backslashes in config path', () => {
      const config: LayerguardConfig = {
        layers: {
          components: { path: 'src\\components' }, // Windows backslashes
        },
        flow: [],
      }
      const mapper = createLayerMapper(config)

      const result = mapper.map('src/components/Button.tsx')

      expect(result?.layer).toBe('components')
    })

    it('does not match partial directory names', () => {
      // src/util should NOT match when layer path is src/utils
      const config: LayerguardConfig = {
        layers: {
          utils: { path: 'src/utils' },
        },
        flow: [],
      }
      const mapper = createLayerMapper(config)

      // src/util is a different directory than src/utils
      const result = mapper.map('src/util/helper.ts')

      expect(result).toBeNull()
    })
  })

  describe('mapAll', () => {
    it('maps multiple files', () => {
      const mapper = createLayerMapper(basicConfig)

      const results = mapper.mapAll([
        'src/components/Button.tsx',
        'src/hooks/useFetch.ts',
        'src/other/file.ts',
      ])

      expect(results.size).toBe(3)
      expect(results.get('src/components/Button.tsx')?.layer).toBe('components')
      expect(results.get('src/hooks/useFetch.ts')?.layer).toBe('hooks')
      expect(results.get('src/other/file.ts')).toBeNull()
    })
  })

  describe('getLayerNames', () => {
    it('returns all layer names', () => {
      const mapper = createLayerMapper(basicConfig)

      const names = mapper.getLayerNames()

      expect(names).toContain('components')
      expect(names).toContain('hooks')
      expect(names).toContain('utils')
    })
  })

  describe('getSublayerNames', () => {
    it('returns sublayer names for a layer', () => {
      const mapper = createLayerMapper(configWithSublayers)

      const names = mapper.getSublayerNames('components')

      expect(names).toContain('features')
      expect(names).toContain('shared')
      expect(names).toContain('app')
    })

    it('returns empty array for layer without sublayers', () => {
      const mapper = createLayerMapper(configWithSublayers)

      const names = mapper.getSublayerNames('hooks')

      expect(names).toEqual([])
    })

    it('returns empty array for unknown layer', () => {
      const mapper = createLayerMapper(configWithSublayers)

      const names = mapper.getSublayerNames('unknown')

      expect(names).toEqual([])
    })
  })
})
