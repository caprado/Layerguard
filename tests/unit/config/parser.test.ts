import { describe, it, expect } from 'vitest'
import {
  parseFlowRule,
  parseFlowRules,
  buildFlowGraph,
  canImport,
  findIsolatedLayers,
  FlowParseError,
} from '../../../src/config/parser.js'

describe('parseFlowRule', () => {
  describe('unidirectional rules (->)', () => {
    it('parses simple unidirectional rule', () => {
      const result = parseFlowRule('A -> B')
      expect(result).toEqual([{
        from: 'A',
        to: 'B',
        direction: 'unidirectional',
      }])
    })

    it('handles no spaces around arrow', () => {
      const result = parseFlowRule('pages->components')
      expect(result).toEqual([{
        from: 'pages',
        to: 'components',
        direction: 'unidirectional',
      }])
    })

    it('handles extra spaces around arrow', () => {
      const result = parseFlowRule('hooks   ->   api')
      expect(result).toEqual([{
        from: 'hooks',
        to: 'api',
        direction: 'unidirectional',
      }])
    })

    it('handles leading and trailing spaces', () => {
      const result = parseFlowRule('  utils -> types  ')
      expect(result).toEqual([{
        from: 'utils',
        to: 'types',
        direction: 'unidirectional',
      }])
    })
  })

  describe('bidirectional rules (<->)', () => {
    it('parses simple bidirectional rule', () => {
      const result = parseFlowRule('hooks <-> api')
      expect(result).toEqual([{
        from: 'hooks',
        to: 'api',
        direction: 'bidirectional',
      }])
    })

    it('handles no spaces around arrow', () => {
      const result = parseFlowRule('A<->B')
      expect(result).toEqual([{
        from: 'A',
        to: 'B',
        direction: 'bidirectional',
      }])
    })

    it('handles extra spaces', () => {
      const result = parseFlowRule('  hooks   <->   stores  ')
      expect(result).toEqual([{
        from: 'hooks',
        to: 'stores',
        direction: 'bidirectional',
      }])
    })
  })

  describe('chained rules (A -> B -> C)', () => {
    it('expands chain into multiple rules', () => {
      const result = parseFlowRule('handlers -> services -> repository')
      expect(result).toEqual([
        { from: 'handlers', to: 'services', direction: 'unidirectional' },
        { from: 'services', to: 'repository', direction: 'unidirectional' },
      ])
    })

    it('handles longer chains', () => {
      const result = parseFlowRule('A -> B -> C -> D')
      expect(result).toEqual([
        { from: 'A', to: 'B', direction: 'unidirectional' },
        { from: 'B', to: 'C', direction: 'unidirectional' },
        { from: 'C', to: 'D', direction: 'unidirectional' },
      ])
    })

    it('handles no spaces in chain', () => {
      const result = parseFlowRule('A->B->C')
      expect(result).toEqual([
        { from: 'A', to: 'B', direction: 'unidirectional' },
        { from: 'B', to: 'C', direction: 'unidirectional' },
      ])
    })

    it('handles extra spaces in chain', () => {
      const result = parseFlowRule('  A   ->   B   ->   C  ')
      expect(result).toEqual([
        { from: 'A', to: 'B', direction: 'unidirectional' },
        { from: 'B', to: 'C', direction: 'unidirectional' },
      ])
    })

    it('throws for mixed operators', () => {
      expect(() => parseFlowRule('A <-> B -> C')).toThrow(FlowParseError)
      expect(() => parseFlowRule('A <-> B -> C')).toThrow("Cannot mix '<->' and '->'")
    })

    it('throws for empty layer in chain', () => {
      expect(() => parseFlowRule('A -> -> C')).toThrow(FlowParseError)
      expect(() => parseFlowRule('A -> -> C')).toThrow('Empty layer name')
    })
  })

  describe('invalid rules', () => {
    it('throws for empty string', () => {
      expect(() => parseFlowRule('')).toThrow(FlowParseError)
    })

    it('throws for non-string input', () => {
      expect(() => parseFlowRule(null as unknown as string)).toThrow(FlowParseError)
      expect(() => parseFlowRule(undefined as unknown as string)).toThrow(FlowParseError)
    })

    it('throws for missing arrow', () => {
      expect(() => parseFlowRule('A B')).toThrow(FlowParseError)
      expect(() => parseFlowRule('A B')).toThrow('Missing arrow operator')
    })

    it('throws for double arrow (-->)', () => {
      expect(() => parseFlowRule('A --> B')).toThrow(FlowParseError)
      expect(() => parseFlowRule('A --> B')).toThrow("Use '->' for unidirectional")
    })

    it('throws for wrong direction arrow (<-)', () => {
      expect(() => parseFlowRule('A <- B')).toThrow(FlowParseError)
      expect(() => parseFlowRule('A <- B')).toThrow("Did you mean '<->'")
    })

    it('throws for arrow only', () => {
      expect(() => parseFlowRule('->')).toThrow(FlowParseError)
    })

    it('throws for missing from layer', () => {
      expect(() => parseFlowRule('-> B')).toThrow(FlowParseError)
    })

    it('throws for missing to layer', () => {
      expect(() => parseFlowRule('A ->')).toThrow(FlowParseError)
    })
  })
})

describe('parseFlowRules', () => {
  it('parses multiple rules', () => {
    const rules = ['pages -> components', 'hooks <-> api', 'utils -> types']
    const result = parseFlowRules(rules)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ from: 'pages', to: 'components', direction: 'unidirectional' })
    expect(result[1]).toEqual({ from: 'hooks', to: 'api', direction: 'bidirectional' })
    expect(result[2]).toEqual({ from: 'utils', to: 'types', direction: 'unidirectional' })
  })

  it('expands chained rules', () => {
    const rules = ['handlers -> services -> repository']
    const result = parseFlowRules(rules)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ from: 'handlers', to: 'services', direction: 'unidirectional' })
    expect(result[1]).toEqual({ from: 'services', to: 'repository', direction: 'unidirectional' })
  })

  it('mixes simple and chained rules', () => {
    const rules = ['A -> B -> C', 'X <-> Y']
    const result = parseFlowRules(rules)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ from: 'A', to: 'B', direction: 'unidirectional' })
    expect(result[1]).toEqual({ from: 'B', to: 'C', direction: 'unidirectional' })
    expect(result[2]).toEqual({ from: 'X', to: 'Y', direction: 'bidirectional' })
  })

  it('returns empty array for empty input', () => {
    expect(parseFlowRules([])).toEqual([])
  })

  it('throws on first invalid rule', () => {
    const rules = ['A -> B', 'invalid', 'C -> D']
    expect(() => parseFlowRules(rules)).toThrow(FlowParseError)
  })
})

describe('buildFlowGraph', () => {
  it('builds graph from unidirectional rules', () => {
    const rules = parseFlowRules(['A -> B', 'B -> C'])
    const graph = buildFlowGraph(rules)

    expect(graph.size).toBe(3)
    expect(graph.get('A')?.has('B')).toBe(true)
    expect(graph.get('A')?.has('C')).toBe(false)
    expect(graph.get('B')?.has('C')).toBe(true)
    expect(graph.get('C')?.size).toBe(0)
  })

  it('builds graph from chained rules', () => {
    const rules = parseFlowRules(['handlers -> services -> repository'])
    const graph = buildFlowGraph(rules)

    expect(graph.size).toBe(3)
    expect(canImport(graph, 'handlers', 'services')).toBe(true)
    expect(canImport(graph, 'services', 'repository')).toBe(true)
    expect(canImport(graph, 'handlers', 'repository')).toBe(false)
    expect(canImport(graph, 'repository', 'services')).toBe(false)
  })

  it('builds graph from bidirectional rules', () => {
    const rules = parseFlowRules(['A <-> B'])
    const graph = buildFlowGraph(rules)

    expect(graph.get('A')?.has('B')).toBe(true)
    expect(graph.get('B')?.has('A')).toBe(true)
  })

  it('handles mixed rules', () => {
    const rules = parseFlowRules(['pages -> components', 'hooks <-> api', 'api -> utils'])
    const graph = buildFlowGraph(rules)

    expect(canImport(graph, 'pages', 'components')).toBe(true)
    expect(canImport(graph, 'components', 'pages')).toBe(false)
    expect(canImport(graph, 'hooks', 'api')).toBe(true)
    expect(canImport(graph, 'api', 'hooks')).toBe(true)
    expect(canImport(graph, 'api', 'utils')).toBe(true)
    expect(canImport(graph, 'utils', 'api')).toBe(false)
  })

  it('returns empty graph for empty rules', () => {
    const graph = buildFlowGraph([])
    expect(graph.size).toBe(0)
  })

  it('does not create duplicate edges', () => {
    const rules = parseFlowRules(['A -> B', 'A -> B'])
    const graph = buildFlowGraph(rules)

    expect(graph.get('A')?.size).toBe(1)
  })
})

describe('canImport', () => {
  it('returns true for allowed import', () => {
    const rules = parseFlowRules(['A -> B'])
    const graph = buildFlowGraph(rules)

    expect(canImport(graph, 'A', 'B')).toBe(true)
  })

  it('returns false for disallowed import', () => {
    const rules = parseFlowRules(['A -> B'])
    const graph = buildFlowGraph(rules)

    expect(canImport(graph, 'B', 'A')).toBe(false)
  })

  it('returns false for unknown layers', () => {
    const rules = parseFlowRules(['A -> B'])
    const graph = buildFlowGraph(rules)

    expect(canImport(graph, 'X', 'Y')).toBe(false)
    expect(canImport(graph, 'A', 'X')).toBe(false)
  })
})

describe('findIsolatedLayers', () => {
  it('finds layers with no connections', () => {
    const rules = parseFlowRules(['A -> B'])
    const graph = buildFlowGraph(rules)

    // Add an isolated layer manually
    graph.set('C', new Set())

    const isolated = findIsolatedLayers(graph)
    expect(isolated).toContain('C')
    expect(isolated).not.toContain('A')
    expect(isolated).not.toContain('B')
  })

  it('returns empty array when all layers are connected', () => {
    const rules = parseFlowRules(['A -> B', 'B -> C', 'C -> A'])
    const graph = buildFlowGraph(rules)

    expect(findIsolatedLayers(graph)).toEqual([])
  })

  it('returns empty array for empty graph', () => {
    expect(findIsolatedLayers(new Map())).toEqual([])
  })
})
