import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runShow } from '../../../src/cli/show.js'
import * as loader from '../../../src/config/loader.js'
import type { LayerguardConfig } from '../../../src/config/types.js'

// Mock the config loader
vi.mock('../../../src/config/loader.js')

describe('runShow', () => {
  const mockConfig: LayerguardConfig = {
    layers: {
      components: { path: 'src/components' },
      hooks: { path: 'src/hooks' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> hooks', 'hooks -> utils', 'components -> utils'],
  }

  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock process.exit to throw so we can test exit behavior
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Process exited with code ${code}`)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs an architecture diagram', async () => {
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })

    await runShow()

    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('Layerguard Architecture')
    expect(output).toContain('components')
    expect(output).toContain('hooks')
    expect(output).toContain('utils')
  })

  it('uses ASCII characters when ascii option is true', async () => {
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })

    await runShow({ ascii: true })

    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('+')
    expect(output).not.toContain('┌')
  })

  it('outputs flow summary when flowOnly is true', async () => {
    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: mockConfig,
      configPath: 'layerguard.config.ts',
    })

    await runShow({ flowOnly: true })

    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('Layer dependencies:')
    expect(output).toContain('components -> hooks')
    expect(output).not.toContain('Layerguard Architecture')
  })

  it('exits with code 1 on config load error', async () => {
    vi.mocked(loader.loadConfig).mockRejectedValue(new Error('Config not found'))

    await expect(runShow()).rejects.toThrow('Process exited with code 1')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(console.error).toHaveBeenCalled()
  })

  it('exits with code 1 on invalid config', async () => {
    const invalidConfig: LayerguardConfig = {
      layers: {
        invalid: { path: '' },
      },
      flow: [],
    }

    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: invalidConfig,
      configPath: 'layerguard.config.ts',
    })

    await expect(runShow()).rejects.toThrow('Process exited with code 1')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(console.error).toHaveBeenCalled()
  })

  it('shows sublayers in the diagram', async () => {
    const configWithSublayers: LayerguardConfig = {
      layers: {
        components: {
          path: 'src/components',
          sublayers: {
            shared: { path: 'shared' },
            features: { path: 'features', isolated: true },
          },
        },
      },
      flow: [],
    }

    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: configWithSublayers,
      configPath: 'layerguard.config.ts',
    })

    await runShow()

    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('shared')
    expect(output).toContain('features')
    expect(output).toContain('[isolated]')
  })

  it('shows sublayer flow rules in flow summary', async () => {
    const configWithSublayerFlow: LayerguardConfig = {
      layers: {
        components: {
          path: 'src/components',
          sublayers: {
            shared: { path: 'shared' },
            features: { path: 'features' },
          },
          flow: ['features -> shared'],
        },
      },
      flow: [],
    }

    vi.mocked(loader.loadConfig).mockResolvedValue({
      config: configWithSublayerFlow,
      configPath: 'layerguard.config.ts',
    })

    await runShow({ flowOnly: true })

    expect(console.log).toHaveBeenCalled()
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string
    expect(output).toContain('components sublayers:')
    expect(output).toContain('features -> shared')
  })
})
