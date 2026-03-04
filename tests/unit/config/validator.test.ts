import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { validateConfig } from '../../../src/config/validator.js'
import type { ArchgateConfig } from '../../../src/config/types.js'

describe('validateConfig', () => {
  let testDir: string

  beforeEach(() => {
    // Create a temp directory for testing path validation
    testDir = join(tmpdir(), `archgate-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    mkdirSync(join(testDir, 'components'), { recursive: true })
    mkdirSync(join(testDir, 'components', 'features'), { recursive: true })
    mkdirSync(join(testDir, 'components', 'shared'), { recursive: true })
    mkdirSync(join(testDir, 'hooks'), { recursive: true })
    mkdirSync(join(testDir, 'utils'), { recursive: true })
    mkdirSync(join(testDir, 'types'), { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('required fields', () => {
    it('fails if layers is missing', () => {
      const config = { flow: ['A -> B'] } as unknown as ArchgateConfig
      const result = validateConfig(config, testDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'MISSING_LAYERS')).toBe(true)
    })

    it('fails if flow is missing', () => {
      const config = { layers: { A: { path: 'a' } } } as unknown as ArchgateConfig
      const result = validateConfig(config, testDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'MISSING_FLOW')).toBe(true)
    })

    it('passes with valid minimal config', () => {
      const config: ArchgateConfig = {
        layers: {
          components: { path: 'components' },
          hooks: { path: 'hooks' },
        },
        flow: ['components -> hooks'],
      }
      const result = validateConfig(config, testDir)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('layer validation', () => {
    it('fails if layer path is missing', () => {
      const config = {
        layers: {
          components: {} as { path: string },
        },
        flow: [],
      }
      const result = validateConfig(config as ArchgateConfig, testDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'MISSING_LAYER_PATH')).toBe(true)
    })

    it('warns if layer path does not exist', () => {
      const config: ArchgateConfig = {
        layers: {
          nonexistent: { path: 'does-not-exist' },
        },
        flow: [],
      }
      const result = validateConfig(config, testDir)

      expect(result.warnings.some((e) => e.code === 'LAYER_PATH_NOT_FOUND')).toBe(true)
    })
  })

  describe('flow rule validation', () => {
    it('fails if flow rule references unknown layer', () => {
      const config: ArchgateConfig = {
        layers: {
          components: { path: 'components' },
        },
        flow: ['components -> unknown'],
      }
      const result = validateConfig(config, testDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'UNKNOWN_LAYER_IN_FLOW')).toBe(true)
    })

    it('fails if flow rule has invalid syntax', () => {
      const config: ArchgateConfig = {
        layers: {
          components: { path: 'components' },
          hooks: { path: 'hooks' },
        },
        flow: ['components --> hooks'],
      }
      const result = validateConfig(config, testDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_FLOW_RULE')).toBe(true)
    })

    it('warns if a layer is not referenced in any flow rule', () => {
      const config: ArchgateConfig = {
        layers: {
          components: { path: 'components' },
          hooks: { path: 'hooks' },
          orphan: { path: 'utils' },
        },
        flow: ['components -> hooks'],
      }
      const result = validateConfig(config, testDir)

      expect(result.warnings.some((e) => e.code === 'LAYER_NOT_IN_FLOW')).toBe(true)
    })

    it('builds flow graph for valid config', () => {
      const config: ArchgateConfig = {
        layers: {
          components: { path: 'components' },
          hooks: { path: 'hooks' },
        },
        flow: ['components -> hooks'],
      }
      const result = validateConfig(config, testDir)

      expect(result.flowGraph).not.toBeNull()
      expect(result.flowGraph?.get('components')?.has('hooks')).toBe(true)
    })
  })

  describe('sublayer validation', () => {
    it('validates sublayer paths', () => {
      const config: ArchgateConfig = {
        layers: {
          components: {
            path: 'components',
            sublayers: {
              features: { path: 'components/features' },
              shared: { path: 'components/shared' },
            },
            flow: ['features -> shared'],
          },
        },
        flow: [],
      }
      const result = validateConfig(config, testDir)

      // No path errors because both exist
      expect(result.errors.filter((e) => e.code === 'SUBLAYER_PATH_NOT_FOUND')).toHaveLength(0)
    })

    it('fails if sublayer flow references unknown sublayer', () => {
      const config: ArchgateConfig = {
        layers: {
          components: {
            path: 'components',
            sublayers: {
              features: { path: 'components/features' },
            },
            flow: ['features -> unknown'],
          },
        },
        flow: [],
      }
      const result = validateConfig(config, testDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'UNKNOWN_SUBLAYER_IN_FLOW')).toBe(true)
    })
  })

  describe('framework validation', () => {
    it('passes with valid framework', () => {
      const config: ArchgateConfig = {
        framework: 'nextjs-app',
        layers: {
          components: { path: 'components' },
        },
        flow: [],
      }
      const result = validateConfig(config, testDir)

      expect(result.errors.filter((e) => e.code === 'INVALID_FRAMEWORK')).toHaveLength(0)
    })

    it('fails with invalid framework', () => {
      const config = {
        framework: 'invalid-framework',
        layers: {
          components: { path: 'components' },
        },
        flow: [],
      } as unknown as ArchgateConfig
      const result = validateConfig(config, testDir)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_FRAMEWORK')).toBe(true)
    })
  })

  describe('rules validation', () => {
    it('passes with valid rules', () => {
      const config: ArchgateConfig = {
        layers: {
          components: { path: 'components' },
        },
        flow: [],
        rules: {
          circular: 'error',
          orphans: 'warn',
          typeOnlyImports: 'ignore',
        },
      }
      const result = validateConfig(config, testDir)

      expect(result.errors.filter((e) => e.code.startsWith('INVALID_RULES_'))).toHaveLength(0)
    })

    it('fails with invalid circular value', () => {
      const config = {
        layers: {
          components: { path: 'components' },
        },
        flow: [],
        rules: {
          circular: 'invalid',
        },
      } as unknown as ArchgateConfig
      const result = validateConfig(config, testDir)

      expect(result.errors.some((e) => e.code === 'INVALID_RULES_CIRCULAR')).toBe(true)
    })

    it('accepts orphans value of off (default behavior)', () => {
      const config: ArchgateConfig = {
        layers: {
          components: { path: 'components' },
        },
        flow: [],
        rules: {
          orphans: 'off',
        },
      }
      const result = validateConfig(config, testDir)

      expect(result.errors.filter((e) => e.code === 'INVALID_RULES_ORPHANS')).toHaveLength(0)
    })

    it('accepts orphans value of error', () => {
      const config: ArchgateConfig = {
        layers: {
          components: { path: 'components' },
        },
        flow: [],
        rules: {
          orphans: 'error',
        },
      }
      const result = validateConfig(config, testDir)

      expect(result.errors.filter((e) => e.code === 'INVALID_RULES_ORPHANS')).toHaveLength(0)
    })

    it('fails with invalid orphans value', () => {
      const config = {
        layers: {
          components: { path: 'components' },
        },
        flow: [],
        rules: {
          orphans: 'invalid',
        },
      } as unknown as ArchgateConfig
      const result = validateConfig(config, testDir)

      expect(result.errors.some((e) => e.code === 'INVALID_RULES_ORPHANS')).toBe(true)
    })
  })

  describe('exceptions validation', () => {
    it('fails if exception is missing from field', () => {
      const config = {
        layers: {
          components: { path: 'components' },
        },
        flow: [],
        exceptions: [{ to: 'some/path', reason: 'test' }],
      } as unknown as ArchgateConfig
      const result = validateConfig(config, testDir)

      expect(result.errors.some((e) => e.code === 'INVALID_EXCEPTION')).toBe(true)
    })

    it('fails if exception is missing reason field', () => {
      const config = {
        layers: {
          components: { path: 'components' },
        },
        flow: [],
        exceptions: [{ from: 'some/path', to: 'other/path' }],
      } as unknown as ArchgateConfig
      const result = validateConfig(config, testDir)

      expect(result.errors.some((e) => e.code === 'INVALID_EXCEPTION')).toBe(true)
      expect(result.errors.find((e) => e.code === 'INVALID_EXCEPTION')?.message).toContain('reason')
    })

    it('passes with valid exception', () => {
      const config: ArchgateConfig = {
        layers: {
          components: { path: 'components' },
        },
        flow: [],
        exceptions: [
          {
            from: 'hooks/stores/useDialogStore.tsx',
            to: 'components/**',
            reason: 'Dialog store manages global dialog state',
          },
        ],
      }
      const result = validateConfig(config, testDir)

      expect(result.errors.filter((e) => e.code === 'INVALID_EXCEPTION')).toHaveLength(0)
    })
  })
})
