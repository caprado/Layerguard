import { describe, it, expect } from 'vitest'
import { generateDiagram, generateFlowSummary } from '../../../src/output/diagram.js'
import type { ArchgateConfig } from '../../../src/config/types.js'

describe('generateDiagram', () => {
  const basicConfig: ArchgateConfig = {
    layers: {
      components: { path: 'src/components' },
      hooks: { path: 'src/hooks' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> hooks', 'hooks -> utils', 'components -> utils'],
  }

  it('generates a diagram with title', () => {
    const output = generateDiagram(basicConfig)

    expect(output).toContain('Archgate Architecture')
  })

  it('generates boxes for each layer', () => {
    const output = generateDiagram(basicConfig)

    expect(output).toContain('components')
    expect(output).toContain('hooks')
    expect(output).toContain('utils')
  })

  it('shows layer paths', () => {
    const output = generateDiagram(basicConfig)

    expect(output).toContain('src/components')
    expect(output).toContain('src/hooks')
    expect(output).toContain('src/utils')
  })

  it('uses Unicode box characters by default', () => {
    const output = generateDiagram(basicConfig)

    expect(output).toContain('┌')
    expect(output).toContain('┐')
    expect(output).toContain('└')
    expect(output).toContain('┘')
    expect(output).toContain('─')
    expect(output).toContain('│')
  })

  it('uses ASCII characters when unicode is false', () => {
    const output = generateDiagram(basicConfig, { unicode: false })

    expect(output).toContain('+')
    expect(output).toContain('-')
    expect(output).toContain('|')
    expect(output).not.toContain('┌')
    expect(output).not.toContain('─')
  })

  it('shows arrows between layers', () => {
    const output = generateDiagram(basicConfig)

    expect(output).toContain('↓')
  })

  it('shows flow rules when showFlow is true', () => {
    const output = generateDiagram(basicConfig, { showFlow: true })

    expect(output).toContain('Flow rules:')
    expect(output).toContain('components -> hooks')
    expect(output).toContain('hooks -> utils')
  })

  it('hides flow rules when showFlow is false', () => {
    const output = generateDiagram(basicConfig, { showFlow: false })

    expect(output).not.toContain('Flow rules:')
  })

  it('shows sublayers when present', () => {
    const config: ArchgateConfig = {
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

    const output = generateDiagram(config)

    expect(output).toContain('shared')
    expect(output).toContain('features')
    expect(output).toContain('[isolated]')
  })

  it('hides sublayers when showSublayers is false', () => {
    const config: ArchgateConfig = {
      layers: {
        components: {
          path: 'src/components',
          sublayers: {
            shared: { path: 'shared' },
            features: { path: 'features' },
          },
        },
      },
      flow: [],
    }

    const output = generateDiagram(config, { showSublayers: false })

    expect(output).toContain('components')
    expect(output).not.toContain('├── shared')
    expect(output).not.toContain('├── features')
  })

  it('shows sublayer flow rules when present', () => {
    const config: ArchgateConfig = {
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

    const output = generateDiagram(config)

    expect(output).toContain('features -> shared')
  })

  it('orders layers by dependency count', () => {
    const config: ArchgateConfig = {
      layers: {
        utils: { path: 'src/utils' },
        hooks: { path: 'src/hooks' },
        components: { path: 'src/components' },
      },
      flow: ['components -> hooks', 'hooks -> utils', 'components -> utils'],
    }

    const output = generateDiagram(config)
    const componentsIndex = output.indexOf('components')
    const hooksIndex = output.indexOf('hooks')
    const utilsIndex = output.indexOf('utils')

    // Components should come first as it has the most dependencies
    expect(componentsIndex).toBeLessThan(hooksIndex)
    expect(hooksIndex).toBeLessThan(utilsIndex)
  })
})

describe('generateFlowSummary', () => {
  it('generates a flow summary', () => {
    const config: ArchgateConfig = {
      layers: {
        components: { path: 'src/components' },
        hooks: { path: 'src/hooks' },
        utils: { path: 'src/utils' },
      },
      flow: ['components -> hooks', 'hooks -> utils'],
    }

    const output = generateFlowSummary(config)

    expect(output).toContain('Layer dependencies:')
    expect(output).toContain('components -> hooks')
    expect(output).toContain('hooks -> utils')
  })

  it('includes sublayer flows', () => {
    const config: ArchgateConfig = {
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

    const output = generateFlowSummary(config)

    expect(output).toContain('components sublayers:')
    expect(output).toContain('features -> shared')
  })

  it('handles empty flow rules', () => {
    const config: ArchgateConfig = {
      layers: {
        components: { path: 'src/components' },
      },
      flow: [],
    }

    const output = generateFlowSummary(config)

    expect(output).toContain('Layer dependencies:')
  })
})
