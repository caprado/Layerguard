/**
 * Tests for CLI init command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  text: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    step: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
  },
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
}))

vi.mock('../../../src/cli/detect.js')
vi.mock('../../../src/cli/presets.js')
vi.mock('../../../src/cli/generator.js')

import { runInit } from '../../../src/cli/init.js'
import * as p from '@clack/prompts'
import * as detect from '../../../src/cli/detect.js'
import * as presets from '../../../src/cli/presets.js'
import * as generator from '../../../src/cli/generator.js'

describe('runInit', () => {
  const mockPreset = {
    name: 'React + Vite',
    description: 'Standard React/Vite setup',
    layers: {
      components: { path: 'src/components' },
      hooks: { path: 'src/hooks' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> hooks', 'hooks -> utils', 'components -> utils'],
    framework: 'vite-react' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(generator.configFileExists).mockReturnValue(null)
    vi.mocked(detect.detectFramework).mockReturnValue({
      framework: 'vite-react',
      projectRoot: '/project',
      isTypeScript: true,
      details: 'Detected Vite + React',
    })
    vi.mocked(presets.getPresetByFramework).mockReturnValue(mockPreset)
    vi.mocked(presets.getAllPresets).mockReturnValue([mockPreset])
    vi.mocked(generator.generateConfigContent).mockReturnValue('export default {}')
    vi.mocked(generator.writeConfigFile).mockReturnValue('layerguard.config.ts')
    vi.mocked(detect.scanForLayers).mockReturnValue([])
    vi.mocked(p.isCancel).mockReturnValue(false)

    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('existing config handling', () => {
    it('warns when config already exists', async () => {
      vi.mocked(generator.configFileExists).mockReturnValue('layerguard.config.ts')
      vi.mocked(p.confirm).mockResolvedValue(false)

      await runInit()

      expect(p.log.warn).toHaveBeenCalled()
      expect(p.outro).toHaveBeenCalledWith('Setup cancelled')
    })

    it('allows overwriting existing config when confirmed', async () => {
      vi.mocked(generator.configFileExists).mockReturnValue('layerguard.config.ts')
      vi.mocked(p.confirm).mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)

      await runInit()

      expect(generator.writeConfigFile).toHaveBeenCalled()
    })

    it('skips overwrite prompt with --yes flag', async () => {
      vi.mocked(generator.configFileExists).mockReturnValue('layerguard.config.ts')

      await runInit({ yes: true })

      expect(generator.writeConfigFile).toHaveBeenCalled()
    })
  })

  describe('framework detection', () => {
    it('uses detected framework when confirmed', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)

      await runInit()

      expect(presets.getPresetByFramework).toHaveBeenCalledWith('vite-react', true)
    })

    it('falls back to custom setup when framework not confirmed', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(false)
      vi.mocked(p.select).mockResolvedValueOnce('preset')
        .mockResolvedValueOnce(mockPreset)
      vi.mocked(p.confirm).mockResolvedValueOnce(true)

      await runInit()

      expect(generator.writeConfigFile).toHaveBeenCalled()
    })

    it('handles unknown framework', async () => {
      vi.mocked(detect.detectFramework).mockReturnValue({
        framework: 'unknown',
        projectRoot: '/project',
        isTypeScript: true,
        details: 'Unknown framework',
      })
      vi.mocked(p.select).mockResolvedValueOnce('preset')
        .mockResolvedValueOnce(mockPreset)
      vi.mocked(p.confirm).mockResolvedValue(true)

      await runInit()

      expect(generator.writeConfigFile).toHaveBeenCalled()
    })
  })

  describe('preset selection', () => {
    it('uses recommended preset when confirmed', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)

      await runInit()

      expect(generator.writeConfigFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          layers: mockPreset.layers,
          flow: mockPreset.flow,
        }),
        expect.any(Object)
      )
    })

    it('allows custom preset selection', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
      vi.mocked(p.select).mockResolvedValueOnce('preset')
        .mockResolvedValueOnce(mockPreset)
      vi.mocked(p.confirm).mockResolvedValueOnce(true)

      await runInit()

      expect(presets.getAllPresets).toHaveBeenCalled()
    })
  })

  describe('--yes flag (non-interactive mode)', () => {
    it('uses defaults without prompts', async () => {
      await runInit({ yes: true })

      expect(p.confirm).not.toHaveBeenCalled()
      expect(generator.writeConfigFile).toHaveBeenCalled()
    })

    it('uses detected framework preset', async () => {
      await runInit({ yes: true })

      expect(presets.getPresetByFramework).toHaveBeenCalledWith('vite-react', true)
      expect(generator.writeConfigFile).toHaveBeenCalled()
    })

    it('handles unknown framework in non-interactive mode', async () => {
      vi.mocked(detect.detectFramework).mockReturnValue({
        framework: 'unknown',
        projectRoot: '/project',
        isTypeScript: false,
        details: 'Unknown framework',
      })
      vi.mocked(presets.getPresetByFramework).mockReturnValue(undefined)

      await runInit({ yes: true })

      expect(generator.writeConfigFile).toHaveBeenCalled()
    })
  })

  describe('cancellation handling', () => {
    it('handles cancel on overwrite confirmation', async () => {
      vi.mocked(generator.configFileExists).mockReturnValue('layerguard.config.ts')
      vi.mocked(p.confirm).mockResolvedValue(Symbol('cancel') as unknown as boolean)
      vi.mocked(p.isCancel).mockReturnValue(true)

      await runInit()

      expect(p.outro).toHaveBeenCalledWith('Setup cancelled')
      expect(generator.writeConfigFile).not.toHaveBeenCalled()
    })

    it('handles cancel on framework confirmation', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(Symbol('cancel') as unknown as boolean)
      vi.mocked(p.isCancel).mockReturnValueOnce(true)

      await runInit()

      expect(p.outro).toHaveBeenCalledWith('Setup cancelled')
    })
  })

  describe('config output', () => {
    it('includes default rules', async () => {
      await runInit({ yes: true })

      expect(generator.writeConfigFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          rules: {
            circular: 'error',
            typeOnlyImports: 'ignore',
          },
        }),
        expect.any(Object)
      )
    })

    it('includes default ignore patterns', async () => {
      await runInit({ yes: true })

      expect(generator.writeConfigFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          ignore: expect.arrayContaining(['**/*.test.ts', '**/*.spec.ts']),
        }),
        expect.any(Object)
      )
    })

    it('shows preview before writing in interactive mode', async () => {
      vi.mocked(p.confirm).mockResolvedValue(true)

      await runInit()

      expect(generator.generateConfigContent).toHaveBeenCalled()
      expect(p.log.step).toHaveBeenCalledWith('Preview:')
    })
  })

  describe('edge cases', () => {
    it('handles no preset found for detected framework', async () => {
      vi.mocked(presets.getPresetByFramework).mockReturnValue(undefined)
      vi.mocked(p.confirm).mockResolvedValueOnce(true)
      vi.mocked(p.select).mockResolvedValueOnce('preset')
        .mockResolvedValueOnce(mockPreset)
      vi.mocked(p.confirm).mockResolvedValueOnce(true)

      await runInit()

      expect(generator.writeConfigFile).toHaveBeenCalled()
    })

    it('handles cancel on preset confirmation', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(true)
        .mockResolvedValueOnce(Symbol('cancel') as unknown as boolean)
      vi.mocked(p.isCancel).mockReturnValueOnce(false)
        .mockReturnValueOnce(true)

      await runInit()

      expect(p.outro).toHaveBeenCalledWith('Setup cancelled')
    })

    it('handles cancel on write confirmation', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(Symbol('cancel') as unknown as boolean)
      vi.mocked(p.isCancel).mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)

      await runInit()

      expect(p.outro).toHaveBeenCalledWith('Setup cancelled')
    })

    it('handles declining write confirmation', async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)

      await runInit()

      expect(p.outro).toHaveBeenCalledWith('Setup cancelled')
      expect(generator.writeConfigFile).not.toHaveBeenCalled()
    })

    it('handles custom setup path selection', async () => {
      const mockDirs = [
        { name: 'components', path: 'src/components', subdirs: [], isCommon: true, fileCount: 5 },
        { name: 'utils', path: 'src/utils', subdirs: [], isCommon: true, fileCount: 3 },
      ]
      vi.mocked(detect.detectFramework).mockReturnValue({
        framework: 'unknown',
        projectRoot: '/project',
        isTypeScript: true,
        details: 'Unknown framework',
      })
      vi.mocked(p.select).mockResolvedValueOnce('custom')
      vi.mocked(detect.scanForLayers).mockReturnValue(mockDirs)
      // multiselect returns the selected DirectoryInfo objects (not strings)
      vi.mocked(p.multiselect).mockResolvedValueOnce(mockDirs)
      vi.mocked(detect.suggestFlowRules).mockReturnValue(['components -> utils'])
      vi.mocked(p.confirm).mockResolvedValue(true)

      await runInit()

      expect(detect.scanForLayers).toHaveBeenCalled()
    })
  })
})
