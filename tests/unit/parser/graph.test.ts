import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildDependencyGraph,
  getDependencies,
  getDependents,
  hasDependency,
  getGraphStats,
} from '../../../src/parser/graph.js'

describe('buildDependencyGraph', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `layerguard-graph-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    mkdirSync(join(testDir, 'src'), { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('builds graph for simple project', () => {
    writeFileSync(join(testDir, 'src', 'utils.ts'), 'export const foo = 1')
    writeFileSync(
      join(testDir, 'src', 'index.ts'),
      `import { foo } from './utils'\nexport { foo }`
    )

    const graph = buildDependencyGraph({ projectRoot: testDir })

    expect(graph.files.size).toBe(2)
    expect(graph.files.has('src/index.ts')).toBe(true)
    expect(graph.files.has('src/utils.ts')).toBe(true)
  })

  it('captures dependency edges', () => {
    writeFileSync(join(testDir, 'src', 'utils.ts'), 'export const foo = 1')
    writeFileSync(join(testDir, 'src', 'index.ts'), `import { foo } from './utils'`)

    const graph = buildDependencyGraph({ projectRoot: testDir })

    expect(hasDependency(graph, 'src/index.ts', 'src/utils.ts')).toBe(true)
    expect(hasDependency(graph, 'src/utils.ts', 'src/index.ts')).toBe(false)
  })

  it('excludes external imports', () => {
    writeFileSync(
      join(testDir, 'src', 'index.ts'),
      `import React from 'react'\nimport { foo } from './utils'`
    )
    writeFileSync(join(testDir, 'src', 'utils.ts'), 'export const foo = 1')

    const graph = buildDependencyGraph({ projectRoot: testDir })

    expect(graph.externalImports.has('react')).toBe(true)
    expect(graph.edges.every((e) => e.target !== 'react')).toBe(true)
  })

  it('handles multiple imports from same file', () => {
    writeFileSync(join(testDir, 'src', 'utils.ts'), 'export const foo = 1\nexport const bar = 2')
    writeFileSync(
      join(testDir, 'src', 'index.ts'),
      `import { foo } from './utils'\nimport { bar } from './utils'`
    )

    const graph = buildDependencyGraph({ projectRoot: testDir })

    // Should have 2 edges but 1 unique dependency
    expect(graph.edges.filter((e) => e.source === 'src/index.ts').length).toBe(2)
    expect(getDependencies(graph, 'src/index.ts')).toHaveLength(1)
  })

  it('handles re-exports', () => {
    writeFileSync(join(testDir, 'src', 'internal.ts'), 'export const foo = 1')
    writeFileSync(join(testDir, 'src', 'barrel.ts'), `export { foo } from './internal'`)
    writeFileSync(join(testDir, 'src', 'index.ts'), `import { foo } from './barrel'`)

    const graph = buildDependencyGraph({ projectRoot: testDir })

    expect(hasDependency(graph, 'src/index.ts', 'src/barrel.ts')).toBe(true)
    expect(hasDependency(graph, 'src/barrel.ts', 'src/internal.ts')).toBe(true)
  })

  it('excludes type-only imports by default', () => {
    writeFileSync(join(testDir, 'src', 'types.ts'), 'export type Foo = string')
    writeFileSync(
      join(testDir, 'src', 'index.ts'),
      `import type { Foo } from './types'\nimport { bar } from './utils'`
    )
    writeFileSync(join(testDir, 'src', 'utils.ts'), 'export const bar = 1')

    const graph = buildDependencyGraph({ projectRoot: testDir })

    expect(hasDependency(graph, 'src/index.ts', 'src/types.ts')).toBe(false)
    expect(hasDependency(graph, 'src/index.ts', 'src/utils.ts')).toBe(true)
  })

  it('includes type-only imports when configured', () => {
    writeFileSync(join(testDir, 'src', 'types.ts'), 'export type Foo = string')
    writeFileSync(join(testDir, 'src', 'index.ts'), `import type { Foo } from './types'`)

    const graph = buildDependencyGraph({
      projectRoot: testDir,
      includeTypeOnlyImports: true,
    })

    expect(hasDependency(graph, 'src/index.ts', 'src/types.ts')).toBe(true)
  })

  it('handles dynamic imports', () => {
    writeFileSync(join(testDir, 'src', 'lazy.ts'), 'export const lazy = 1')
    writeFileSync(
      join(testDir, 'src', 'index.ts'),
      `const mod = await import('./lazy')`
    )

    const graph = buildDependencyGraph({ projectRoot: testDir })

    expect(hasDependency(graph, 'src/index.ts', 'src/lazy.ts')).toBe(true)
    expect(graph.edges.find((e) => e.target === 'src/lazy.ts')?.kind).toBe('dynamic')
  })

  it('respects ignore patterns', () => {
    mkdirSync(join(testDir, 'src', 'generated'), { recursive: true })
    writeFileSync(join(testDir, 'src', 'generated', 'api.ts'), 'export const api = 1')
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export const foo = 1')

    const graph = buildDependencyGraph({
      projectRoot: testDir,
      ignore: ['**/generated/**'],
    })

    expect(graph.files.has('src/generated/api.ts')).toBe(false)
    expect(graph.files.has('src/index.ts')).toBe(true)
  })

  it('tracks unresolved imports', () => {
    writeFileSync(join(testDir, 'src', 'index.ts'), `import { foo } from './nonexistent'`)

    const graph = buildDependencyGraph({ projectRoot: testDir })

    expect(graph.unresolvedImports.length).toBeGreaterThan(0)
    expect(graph.unresolvedImports[0]?.specifier).toBe('./nonexistent')
  })

  it('tracks parse errors', () => {
    writeFileSync(join(testDir, 'src', 'broken.ts'), 'export const = 1') // Syntax error

    const graph = buildDependencyGraph({ projectRoot: testDir })

    // File should still be in the graph
    expect(graph.files.has('src/broken.ts')).toBe(true)
  })
})

describe('getDependencies', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `layerguard-deps-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    mkdirSync(join(testDir, 'src'), { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('returns direct dependencies', () => {
    writeFileSync(join(testDir, 'src', 'a.ts'), 'export const a = 1')
    writeFileSync(join(testDir, 'src', 'b.ts'), 'export const b = 1')
    writeFileSync(
      join(testDir, 'src', 'index.ts'),
      `import { a } from './a'\nimport { b } from './b'`
    )

    const graph = buildDependencyGraph({ projectRoot: testDir })
    const deps = getDependencies(graph, 'src/index.ts')

    expect(deps).toContain('src/a.ts')
    expect(deps).toContain('src/b.ts')
    expect(deps).toHaveLength(2)
  })

  it('returns empty array for files with no dependencies', () => {
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export const foo = 1')

    const graph = buildDependencyGraph({ projectRoot: testDir })
    const deps = getDependencies(graph, 'src/index.ts')

    expect(deps).toHaveLength(0)
  })

  it('returns empty array for unknown files', () => {
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export const foo = 1')

    const graph = buildDependencyGraph({ projectRoot: testDir })
    const deps = getDependencies(graph, 'src/nonexistent.ts')

    expect(deps).toHaveLength(0)
  })
})

describe('getDependents', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `layerguard-dependents-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    mkdirSync(join(testDir, 'src'), { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('returns files that depend on a given file', () => {
    writeFileSync(join(testDir, 'src', 'utils.ts'), 'export const util = 1')
    writeFileSync(join(testDir, 'src', 'a.ts'), `import { util } from './utils'`)
    writeFileSync(join(testDir, 'src', 'b.ts'), `import { util } from './utils'`)

    const graph = buildDependencyGraph({ projectRoot: testDir })
    const dependents = getDependents(graph, 'src/utils.ts')

    expect(dependents).toContain('src/a.ts')
    expect(dependents).toContain('src/b.ts')
    expect(dependents).toHaveLength(2)
  })

  it('returns empty array for files with no dependents', () => {
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export const foo = 1')
    writeFileSync(join(testDir, 'src', 'other.ts'), 'export const bar = 1')

    const graph = buildDependencyGraph({ projectRoot: testDir })
    const dependents = getDependents(graph, 'src/index.ts')

    expect(dependents).toHaveLength(0)
  })
})

describe('getGraphStats', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `layerguard-stats-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    mkdirSync(join(testDir, 'src'), { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('returns correct statistics', () => {
    writeFileSync(join(testDir, 'src', 'utils.ts'), 'export const foo = 1')
    writeFileSync(
      join(testDir, 'src', 'index.ts'),
      `import { foo } from './utils'\nimport React from 'react'`
    )

    const graph = buildDependencyGraph({ projectRoot: testDir })
    const stats = getGraphStats(graph)

    expect(stats.fileCount).toBe(2)
    expect(stats.edgeCount).toBe(1)
    expect(stats.externalPackageCount).toBe(1)
  })
})
