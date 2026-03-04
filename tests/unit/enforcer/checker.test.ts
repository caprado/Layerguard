import { describe, it, expect } from 'vitest'
import { FlowChecker, createFlowChecker, checkDependencyGraph } from '../../../src/enforcer/checker.js'
import type { LayerguardConfig } from '../../../src/config/types.js'
import type { DependencyGraph, DependencyEdge } from '../../../src/parser/graph.js'

describe('FlowChecker', () => {
  const basicConfig: LayerguardConfig = {
    layers: {
      components: { path: 'src/components' },
      hooks: { path: 'src/hooks' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> hooks', 'hooks -> utils', 'components -> utils'],
  }

  const configWithSublayers: LayerguardConfig = {
    layers: {
      components: {
        path: 'src/components',
        sublayers: {
          features: { path: 'src/components/features', isolated: true },
          shared: { path: 'src/components/shared' },
        },
        flow: ['features -> shared'],
      },
      hooks: { path: 'src/hooks' },
    },
    flow: ['components -> hooks'],
  }

  const bidirectionalConfig: LayerguardConfig = {
    layers: {
      hooks: { path: 'src/hooks' },
      api: { path: 'src/api' },
    },
    flow: ['hooks <-> api'],
  }

  function createEdge(source: string, target: string): DependencyEdge {
    return {
      source,
      target,
      specifier: `./${target.split('/').pop()}`,
      isTypeOnly: false,
      kind: 'static',
      line: 1,
    }
  }

  describe('checkEdge', () => {
    describe('layer flow rules', () => {
      it('allows import following flow direction', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/components/Button.tsx', 'src/hooks/useFetch.ts')

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(true)
        expect(result.violation).toBeUndefined()
      })

      it('disallows import against flow direction', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/hooks/useFetch.ts', 'src/components/Button.tsx')

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(false)
        expect(result.violation).toBeDefined()
        expect(result.violation?.type).toBe('flow')
        expect(result.violation?.sourceLayer).toBe('hooks')
        expect(result.violation?.targetLayer).toBe('components')
      })

      it('disallows import between unconnected layers', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/utils/format.ts', 'src/components/Button.tsx')

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(false)
        expect(result.violation?.type).toBe('flow')
      })

      it('allows bidirectional flow in both directions', () => {
        const checker = createFlowChecker(bidirectionalConfig)

        const edge1 = createEdge('src/hooks/useFetch.ts', 'src/api/client.ts')
        const edge2 = createEdge('src/api/client.ts', 'src/hooks/useFetch.ts')

        expect(checker.checkEdge(edge1).allowed).toBe(true)
        expect(checker.checkEdge(edge2).allowed).toBe(true)
      })
    })

    describe('same layer imports', () => {
      it('allows imports within same layer', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/components/Button.tsx', 'src/components/Icon.tsx')

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(true)
      })

      it('allows imports within same sublayer', () => {
        const checker = createFlowChecker(configWithSublayers)
        const edge = createEdge(
          'src/components/shared/Button.tsx',
          'src/components/shared/Icon.tsx'
        )

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(true)
      })
    })

    describe('sublayer flow rules', () => {
      it('allows import following sublayer flow', () => {
        const checker = createFlowChecker(configWithSublayers)
        const edge = createEdge(
          'src/components/features/calendar/Calendar.tsx',
          'src/components/shared/Button.tsx'
        )

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(true)
      })

      it('disallows import against sublayer flow', () => {
        const checker = createFlowChecker(configWithSublayers)
        const edge = createEdge(
          'src/components/shared/Button.tsx',
          'src/components/features/calendar/Calendar.tsx'
        )

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(false)
        expect(result.violation?.type).toBe('flow')
      })
    })

    describe('feature isolation', () => {
      it('allows import within same feature', () => {
        const checker = createFlowChecker(configWithSublayers)
        const edge = createEdge(
          'src/components/features/calendar/Calendar.tsx',
          'src/components/features/calendar/Day.tsx'
        )

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(true)
      })

      it('disallows import across isolated features', () => {
        const checker = createFlowChecker(configWithSublayers)
        const edge = createEdge(
          'src/components/features/calendar/Calendar.tsx',
          'src/components/features/build/BuildSchedule.tsx'
        )

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(false)
        expect(result.violation?.type).toBe('isolation')
      })
    })

    describe('unmapped files', () => {
      it('creates warning for unmapped source file', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/other/file.ts', 'src/components/Button.tsx')

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(false)
        expect(result.violation?.type).toBe('unmapped')
        expect(result.violation?.severity).toBe('warn')
      })

      it('allows import to unmapped target file', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/components/Button.tsx', 'src/other/file.ts')

        const result = checker.checkEdge(edge)

        expect(result.allowed).toBe(true)
      })

      it('respects custom unmapped severity', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/other/file.ts', 'src/components/Button.tsx')

        const result = checker.checkEdge(edge, { unmappedSeverity: 'error' })

        expect(result.violation?.severity).toBe('error')
      })
    })

    describe('unlayeredImports', () => {
      it('allows import to unlayered file when unlayeredImports is ignore', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/components/Button.tsx', 'src/misc/helpers.ts')

        const result = checker.checkEdge(edge, { unlayeredImports: 'ignore' })

        expect(result.allowed).toBe(true)
        expect(result.violation).toBeUndefined()
      })

      it('flags import to unlayered file when unlayeredImports is error', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/components/Button.tsx', 'src/misc/helpers.ts')

        const result = checker.checkEdge(edge, { unlayeredImports: 'error' })

        expect(result.allowed).toBe(false)
        expect(result.violation?.type).toBe('unlayered')
        expect(result.violation?.severity).toBe('error')
        expect(result.violation?.sourceLayer).toBe('components')
        expect(result.violation?.targetFile).toBe('src/misc/helpers.ts')
      })

      it('flags import to unlayered file when unlayeredImports is warn', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/components/Button.tsx', 'src/misc/helpers.ts')

        const result = checker.checkEdge(edge, { unlayeredImports: 'warn' })

        expect(result.allowed).toBe(false)
        expect(result.violation?.type).toBe('unlayered')
        expect(result.violation?.severity).toBe('warn')
      })

      it('does not affect imports between layered files', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/components/Button.tsx', 'src/hooks/useFetch.ts')

        const result = checker.checkEdge(edge, { unlayeredImports: 'error' })

        expect(result.allowed).toBe(true)
      })

      it('still flags flow violations with unlayeredImports enabled', () => {
        const checker = createFlowChecker(basicConfig)
        const edge = createEdge('src/hooks/useFetch.ts', 'src/components/Button.tsx')

        const result = checker.checkEdge(edge, { unlayeredImports: 'error' })

        expect(result.allowed).toBe(false)
        expect(result.violation?.type).toBe('flow')
      })
    })
  })

  describe('checkGraph', () => {
    it('checks all edges in graph', () => {
      const checker = createFlowChecker(basicConfig)

      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: new Set(['src/components/A.tsx', 'src/hooks/B.ts', 'src/utils/C.ts']),
        adjacencyList: new Map([
          ['src/components/A.tsx', new Set(['src/hooks/B.ts'])],
          ['src/hooks/B.ts', new Set(['src/components/A.tsx'])], // Violation!
        ]),
        edges: [
          createEdge('src/components/A.tsx', 'src/hooks/B.ts'),
          createEdge('src/hooks/B.ts', 'src/components/A.tsx'), // Violation!
        ],
        parseErrors: new Map(),
        unresolvedImports: [],
        externalImports: new Set(),
      }

      const violations = checker.checkGraph(graph)

      expect(violations).toHaveLength(1)
      expect(violations[0]?.type).toBe('flow')
      expect(violations[0]?.sourceFile).toBe('src/hooks/B.ts')
    })

    it('returns empty array for valid graph', () => {
      const checker = createFlowChecker(basicConfig)

      const graph: DependencyGraph = {
        projectRoot: '/project',
        files: new Set(['src/components/A.tsx', 'src/hooks/B.ts']),
        adjacencyList: new Map([['src/components/A.tsx', new Set(['src/hooks/B.ts'])]]),
        edges: [createEdge('src/components/A.tsx', 'src/hooks/B.ts')],
        parseErrors: new Map(),
        unresolvedImports: [],
        externalImports: new Set(),
      }

      const violations = checker.checkGraph(graph)

      expect(violations).toHaveLength(0)
    })
  })
})

describe('checkDependencyGraph', () => {
  it('is a convenience function that creates checker and runs check', () => {
    const config: LayerguardConfig = {
      layers: {
        components: { path: 'src/components' },
        hooks: { path: 'src/hooks' },
      },
      flow: ['components -> hooks'],
    }

    const graph: DependencyGraph = {
      projectRoot: '/project',
      files: new Set(['src/hooks/A.ts', 'src/components/B.tsx']),
      adjacencyList: new Map([['src/hooks/A.ts', new Set(['src/components/B.tsx'])]]),
      edges: [
        {
          source: 'src/hooks/A.ts',
          target: 'src/components/B.tsx',
          specifier: '../components/B',
          isTypeOnly: false,
          kind: 'static',
          line: 1,
        },
      ],
      parseErrors: new Map(),
      unresolvedImports: [],
      externalImports: new Set(),
    }

    const violations = checkDependencyGraph(graph, config)

    expect(violations).toHaveLength(1)
    expect(violations[0]?.type).toBe('flow')
  })
})

describe('barrel resolution (import-site enforcement)', () => {
  const barrelConfig: LayerguardConfig = {
    layers: {
      handlers: { path: 'src/handlers' },
      services: { path: 'src/services' },
      repository: { path: 'src/repository' },
    },
    flow: ['handlers -> services', 'services -> repository'],
  }

  function createEdge(source: string, target: string): DependencyEdge {
    return {
      source,
      target,
      specifier: `./${target.split('/').pop()}`,
      isTypeOnly: false,
      kind: 'static',
      line: 1,
    }
  }

  it('allows import through barrel when flow permits import-site layer', () => {
    // handlers imports from services/index.ts (barrel)
    // services/index.ts re-exports from repository/users.ts (internal)
    // Edge is handlers -> services, which is allowed
    const checker = createFlowChecker(barrelConfig)
    const edge = createEdge('src/handlers/foo.ts', 'src/services/index.ts')

    const result = checker.checkEdge(edge)

    expect(result.allowed).toBe(true)
    expect(result.violation).toBeUndefined()
  })

  it('flags direct import to deeper layer bypassing barrel', () => {
    // handlers imports directly from repository/users.ts
    // handlers -> repository is NOT in flow rules, so this is a violation
    const checker = createFlowChecker(barrelConfig)
    const edge = createEdge('src/handlers/foo.ts', 'src/repository/users.ts')

    const result = checker.checkEdge(edge)

    expect(result.allowed).toBe(false)
    expect(result.violation?.type).toBe('flow')
    expect(result.violation?.sourceLayer).toBe('handlers')
    expect(result.violation?.targetLayer).toBe('repository')
  })

  it('enforces based on import target, not re-export origin', () => {
    // This test documents the import-site enforcement policy
    // The target of the edge is services/index.ts (the barrel)
    // NOT repository/users.ts (where the symbol originates)
    const checker = createFlowChecker(barrelConfig)

    // Import to barrel is allowed
    const barrelEdge = createEdge('src/handlers/api.ts', 'src/services/index.ts')
    expect(checker.checkEdge(barrelEdge).allowed).toBe(true)

    // Direct import to repository is not allowed
    const directEdge = createEdge('src/handlers/api.ts', 'src/repository/users.ts')
    expect(checker.checkEdge(directEdge).allowed).toBe(false)
  })
})

describe('barrelResolution config option', () => {
  it('accepts import-site as a valid option', () => {
    const config: LayerguardConfig = {
      layers: {
        a: { path: 'src/a' },
        b: { path: 'src/b' },
      },
      flow: ['a -> b'],
      rules: {
        barrelResolution: 'import-site',
      },
    }

    // Should not throw
    expect(() => createFlowChecker(config)).not.toThrow()
  })

  it('accepts origin as a valid option', () => {
    const config: LayerguardConfig = {
      layers: {
        a: { path: 'src/a' },
        b: { path: 'src/b' },
      },
      flow: ['a -> b'],
      rules: {
        barrelResolution: 'origin',
      },
    }

    // Should not throw
    expect(() => createFlowChecker(config)).not.toThrow()
  })

  it('defaults to import-site when not specified', () => {
    const config: LayerguardConfig = {
      layers: {
        handlers: { path: 'src/handlers' },
        services: { path: 'src/services' },
      },
      flow: ['handlers -> services'],
    }

    // Without explicit setting, import-site behavior is the default
    const checker = createFlowChecker(config)
    const edge: DependencyEdge = {
      source: 'src/handlers/api.ts',
      target: 'src/services/index.ts',
      specifier: '../services',
      isTypeOnly: false,
      kind: 'static',
      line: 1,
    }

    const result = checker.checkEdge(edge)
    expect(result.allowed).toBe(true)
  })
})

describe('orphan detection', () => {
  const config: LayerguardConfig = {
    layers: {
      components: { path: 'src/components' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> utils'],
  }

  function createGraph(files: string[], edges: Array<{ source: string; target: string }>): DependencyGraph {
    const graph: DependencyGraph = {
      projectRoot: '/test',
      files: new Set(files),
      adjacencyList: new Map(),
      edges: [],
      parseErrors: new Map(),
      unresolvedImports: [],
      externalImports: new Set(),
    }

    for (const file of files) {
      graph.adjacencyList.set(file, new Set())
    }

    for (const { source, target } of edges) {
      graph.adjacencyList.get(source)?.add(target)
      graph.edges.push({
        source,
        target,
        specifier: `./${target}`,
        isTypeOnly: false,
        kind: 'static',
        line: 1,
      })
    }

    return graph
  }

  it('does not detect orphans when orphans option is off (default)', () => {
    const checker = createFlowChecker(config)
    const graph = createGraph(
      ['src/components/Button.tsx', 'src/utils/orphan.ts'],
      [{ source: 'src/components/Button.tsx', target: 'src/utils/orphan.ts' }]
    )
    // Button imports orphan, but orphan is not imported by anything else
    // However, Button itself is an orphan (not imported by anything)

    const violations = checker.checkGraph(graph, { orphans: 'off' })

    expect(violations.filter(v => v.type === 'orphan')).toHaveLength(0)
  })

  it('detects orphan files when orphans option is warn', () => {
    const checker = createFlowChecker(config)
    const graph = createGraph(
      ['src/components/Button.tsx', 'src/utils/format.ts', 'src/utils/orphan.ts'],
      [{ source: 'src/components/Button.tsx', target: 'src/utils/format.ts' }]
    )
    // Button imports format, but orphan.ts is not imported by anything

    const violations = checker.checkGraph(graph, { orphans: 'warn' })
    const orphanViolations = violations.filter(v => v.type === 'orphan')

    // Button.tsx is an orphan (not imported), orphan.ts is also an orphan
    expect(orphanViolations.length).toBeGreaterThanOrEqual(1)
    expect(orphanViolations.some(v => v.sourceFile === 'src/utils/orphan.ts')).toBe(true)
    expect(orphanViolations[0]?.severity).toBe('warn')
  })

  it('detects orphan files when orphans option is error', () => {
    const checker = createFlowChecker(config)
    const graph = createGraph(
      ['src/components/Button.tsx', 'src/utils/orphan.ts'],
      []
    )

    const violations = checker.checkGraph(graph, { orphans: 'error' })
    const orphanViolations = violations.filter(v => v.type === 'orphan')

    expect(orphanViolations.length).toBeGreaterThanOrEqual(1)
    expect(orphanViolations[0]?.severity).toBe('error')
  })

  it('does not flag files that are imported by others', () => {
    const checker = createFlowChecker(config)
    const graph = createGraph(
      ['src/components/App.tsx', 'src/components/Button.tsx', 'src/utils/format.ts'],
      [
        { source: 'src/components/App.tsx', target: 'src/components/Button.tsx' },
        { source: 'src/components/Button.tsx', target: 'src/utils/format.ts' },
      ]
    )
    // App imports Button, Button imports format
    // Only App.tsx is an orphan (entry point)

    const violations = checker.checkGraph(graph, { orphans: 'warn' })
    const orphanViolations = violations.filter(v => v.type === 'orphan')

    // Button and format are imported, so they should not be flagged
    expect(orphanViolations.some(v => v.sourceFile === 'src/components/Button.tsx')).toBe(false)
    expect(orphanViolations.some(v => v.sourceFile === 'src/utils/format.ts')).toBe(false)
  })

  it('skips common entry point patterns', () => {
    const checker = createFlowChecker(config)
    const graph = createGraph(
      ['src/index.ts', 'src/main.tsx', 'src/app.ts', 'vite.config.ts', 'src/utils/orphan.ts'],
      []
    )

    const violations = checker.checkGraph(graph, { orphans: 'warn' })
    const orphanViolations = violations.filter(v => v.type === 'orphan')

    // Entry points should not be flagged
    expect(orphanViolations.some(v => v.sourceFile === 'src/index.ts')).toBe(false)
    expect(orphanViolations.some(v => v.sourceFile === 'src/main.tsx')).toBe(false)
    expect(orphanViolations.some(v => v.sourceFile === 'src/app.ts')).toBe(false)
    expect(orphanViolations.some(v => v.sourceFile === 'vite.config.ts')).toBe(false)

    // But orphan.ts should be flagged
    expect(orphanViolations.some(v => v.sourceFile === 'src/utils/orphan.ts')).toBe(true)
  })

  it('includes layer information in orphan violations', () => {
    const checker = createFlowChecker(config)
    const graph = createGraph(
      ['src/utils/orphan.ts'],
      []
    )

    const violations = checker.checkGraph(graph, { orphans: 'warn' })
    const orphanViolations = violations.filter(v => v.type === 'orphan')

    expect(orphanViolations).toHaveLength(1)
    expect(orphanViolations[0]?.sourceFile).toBe('src/utils/orphan.ts')
    // Layer should be included since the file is in the utils layer
    expect((orphanViolations[0] as any).layer).toBe('utils')
  })
})

describe('advanced rules options', () => {
  const config: LayerguardConfig = {
    layers: {
      components: { path: 'src/components' },
      utils: { path: 'src/utils' },
    },
    flow: ['components -> utils'],
  }

  const createGraph = (files: string[], edges: Array<{ source: string; target: string }>): DependencyGraph => ({
    projectRoot: '/test',
    files: new Set(files),
    adjacencyList: new Map(files.map(file => [file, edges.filter(e => e.source === file).map(e => ({
      target: e.target,
      isTypeOnly: false,
      specifier: `./${e.target.split('/').pop()}`,
    }))])),
    edges: edges.map(e => ({
      source: e.source,
      target: e.target,
      isTypeOnly: false,
      specifier: `./${e.target.split('/').pop()}`,
    })),
    parseErrors: new Map(),
    unresolvedImports: [],
    externalImports: new Set(),
  })

  it('passes maxImportDepth option to advanced rules checker', () => {
    const checker = createFlowChecker(config)
    const graph = createGraph(
      ['src/components/Button.tsx', 'src/utils/helper.ts'],
      [{ source: 'src/components/Button.tsx', target: 'src/utils/helper.ts' }]
    )

    // Should not throw when maxImportDepth is provided
    const violations = checker.checkGraph(graph, { maxImportDepth: 5 })
    expect(Array.isArray(violations)).toBe(true)
  })

  it('passes maxImportsPerFile option to advanced rules checker', () => {
    const checker = createFlowChecker(config)
    const graph = createGraph(
      ['src/components/Button.tsx', 'src/utils/helper.ts'],
      [{ source: 'src/components/Button.tsx', target: 'src/utils/helper.ts' }]
    )

    // Should not throw when maxImportsPerFile is provided
    const violations = checker.checkGraph(graph, { maxImportsPerFile: 10 })
    expect(Array.isArray(violations)).toBe(true)
  })

  it('passes both maxImportDepth and maxImportsPerFile options', () => {
    const checker = createFlowChecker(config)
    const graph = createGraph(
      ['src/components/Button.tsx', 'src/utils/helper.ts'],
      [{ source: 'src/components/Button.tsx', target: 'src/utils/helper.ts' }]
    )

    const violations = checker.checkGraph(graph, {
      maxImportDepth: 3,
      maxImportsPerFile: 20,
    })
    expect(Array.isArray(violations)).toBe(true)
  })

  it('exposes layer mapper via getMapper', () => {
    const checker = createFlowChecker(config)
    const mapper = checker.getMapper()

    expect(mapper).toBeDefined()
    expect(mapper.map).toBeDefined()
  })
})
