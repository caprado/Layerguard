import { describe, it, expect } from 'vitest'
import {
  detectCircularDependencies,
  hasAnyCycle,
  findCyclePath,
} from '../../../src/enforcer/circular.js'
import type { DependencyGraph } from '../../../src/parser/graph.js'

function createGraph(adjacencyList: Record<string, string[]>): DependencyGraph {
  const files = new Set<string>()
  const adjMap = new Map<string, Set<string>>()

  for (const [source, targets] of Object.entries(adjacencyList)) {
    files.add(source)
    adjMap.set(source, new Set(targets))
    for (const target of targets) {
      files.add(target)
      if (!adjMap.has(target)) {
        adjMap.set(target, new Set())
      }
    }
  }

  return {
    projectRoot: '/project',
    files,
    adjacencyList: adjMap,
    edges: [],
    parseErrors: new Map(),
    unresolvedImports: [],
    externalImports: new Set(),
  }
}

describe('detectCircularDependencies', () => {
  describe('simple cycles', () => {
    it('detects two-node cycle', () => {
      const graph = createGraph({
        'a.ts': ['b.ts'],
        'b.ts': ['a.ts'],
      })

      const result = detectCircularDependencies(graph)

      expect(result.cycles).toHaveLength(1)
      expect(result.cycles[0]?.files).toContain('a.ts')
      expect(result.cycles[0]?.files).toContain('b.ts')
    })

    it('detects three-node cycle', () => {
      const graph = createGraph({
        'a.ts': ['b.ts'],
        'b.ts': ['c.ts'],
        'c.ts': ['a.ts'],
      })

      const result = detectCircularDependencies(graph)

      expect(result.cycles).toHaveLength(1)
      expect(result.cycles[0]?.files).toHaveLength(3)
    })

    it('detects self-reference', () => {
      const graph = createGraph({
        'a.ts': ['a.ts'],
      })

      const result = detectCircularDependencies(graph)

      expect(result.cycles).toHaveLength(1)
      expect(result.cycles[0]?.files).toEqual(['a.ts'])
    })
  })

  describe('no cycles', () => {
    it('returns empty for acyclic graph', () => {
      const graph = createGraph({
        'a.ts': ['b.ts'],
        'b.ts': ['c.ts'],
        'c.ts': [],
      })

      const result = detectCircularDependencies(graph)

      expect(result.cycles).toHaveLength(0)
    })

    it('returns empty for single node with no edges', () => {
      const graph = createGraph({
        'a.ts': [],
      })

      const result = detectCircularDependencies(graph)

      expect(result.cycles).toHaveLength(0)
    })

    it('returns empty for disconnected acyclic graph', () => {
      const graph = createGraph({
        'a.ts': ['b.ts'],
        'c.ts': ['d.ts'],
      })

      const result = detectCircularDependencies(graph)

      expect(result.cycles).toHaveLength(0)
    })
  })

  describe('multiple cycles', () => {
    it('detects multiple independent cycles', () => {
      const graph = createGraph({
        'a.ts': ['b.ts'],
        'b.ts': ['a.ts'],
        'c.ts': ['d.ts'],
        'd.ts': ['c.ts'],
      })

      const result = detectCircularDependencies(graph)

      expect(result.cycles).toHaveLength(2)
    })

    it('detects nested cycles as single SCC', () => {
      // All nodes in one strongly connected component
      const graph = createGraph({
        'a.ts': ['b.ts'],
        'b.ts': ['c.ts', 'a.ts'],
        'c.ts': ['a.ts'],
      })

      const result = detectCircularDependencies(graph)

      // Should be detected as a single SCC
      expect(result.cycles).toHaveLength(1)
      expect(result.cycles[0]?.files).toHaveLength(3)
    })
  })

  describe('complex graphs', () => {
    it('handles diamond pattern without cycle', () => {
      const graph = createGraph({
        'a.ts': ['b.ts', 'c.ts'],
        'b.ts': ['d.ts'],
        'c.ts': ['d.ts'],
        'd.ts': [],
      })

      const result = detectCircularDependencies(graph)

      expect(result.cycles).toHaveLength(0)
    })

    it('handles diamond pattern with cycle', () => {
      const graph = createGraph({
        'a.ts': ['b.ts', 'c.ts'],
        'b.ts': ['d.ts'],
        'c.ts': ['d.ts'],
        'd.ts': ['a.ts'], // Creates cycle
      })

      const result = detectCircularDependencies(graph)

      expect(result.cycles).toHaveLength(1)
    })
  })

  describe('violations', () => {
    it('creates violations for each cycle', () => {
      const graph = createGraph({
        'a.ts': ['b.ts'],
        'b.ts': ['a.ts'],
      })

      const result = detectCircularDependencies(graph)

      expect(result.violations).toHaveLength(1)
      expect(result.violations[0]?.type).toBe('circular')
      expect(result.violations[0]?.cyclePath).toBeDefined()
    })

    it('cycle path includes closing node', () => {
      const graph = createGraph({
        'a.ts': ['b.ts'],
        'b.ts': ['a.ts'],
      })

      const result = detectCircularDependencies(graph)
      const cyclePath = result.violations[0]?.cyclePath

      // Should close the loop
      expect(cyclePath?.[0]).toBe(cyclePath?.[cyclePath.length - 1])
    })

    it('respects custom severity', () => {
      const graph = createGraph({
        'a.ts': ['b.ts'],
        'b.ts': ['a.ts'],
      })

      const result = detectCircularDependencies(graph, 'warn')

      expect(result.violations[0]?.severity).toBe('warn')
    })
  })
})

describe('hasAnyCycle', () => {
  it('returns true for graph with cycle', () => {
    const graph = createGraph({
      'a.ts': ['b.ts'],
      'b.ts': ['a.ts'],
    })

    expect(hasAnyCycle(graph)).toBe(true)
  })

  it('returns false for acyclic graph', () => {
    const graph = createGraph({
      'a.ts': ['b.ts'],
      'b.ts': ['c.ts'],
      'c.ts': [],
    })

    expect(hasAnyCycle(graph)).toBe(false)
  })

  it('returns true for self-reference', () => {
    const graph = createGraph({
      'a.ts': ['a.ts'],
    })

    expect(hasAnyCycle(graph)).toBe(true)
  })

  it('returns false for empty graph', () => {
    const graph = createGraph({})

    expect(hasAnyCycle(graph)).toBe(false)
  })
})

describe('findCyclePath', () => {
  it('finds path through SCC', () => {
    const graph = createGraph({
      'a.ts': ['b.ts'],
      'b.ts': ['c.ts'],
      'c.ts': ['a.ts'],
    })

    const path = findCyclePath(graph, ['a.ts', 'b.ts', 'c.ts'])

    // Path should form a cycle
    expect(path.length).toBeGreaterThanOrEqual(2)
    expect(path[0]).toBe(path[path.length - 1])
  })

  it('handles self-reference', () => {
    const graph = createGraph({
      'a.ts': ['a.ts'],
    })

    const path = findCyclePath(graph, ['a.ts'])

    expect(path).toEqual(['a.ts', 'a.ts'])
  })

  it('returns input for empty SCC', () => {
    const graph = createGraph({})

    const path = findCyclePath(graph, [])

    expect(path).toEqual([])
  })
})
