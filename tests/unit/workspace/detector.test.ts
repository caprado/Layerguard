/**
 * Tests for workspace detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  detectWorkspace,
  findWorkspacePackage,
  isWorkspaceImport,
  resolveWorkspaceImport,
} from '../../../src/workspace/detector.js'

describe('workspace/detector', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `archgate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  describe('detectWorkspace', () => {
    it('returns none when no workspace config exists', () => {
      const result = detectWorkspace(testDir)
      expect(result.type).toBe('none')
      expect(result.packages).toHaveLength(0)
    })

    it('detects pnpm workspace', () => {
      // Create pnpm-workspace.yaml
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        'packages:\n  - "packages/*"\n'
      )

      // Create a package
      const pkgDir = join(testDir, 'packages', 'pkg-a')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(
        join(pkgDir, 'package.json'),
        JSON.stringify({ name: '@scope/pkg-a' })
      )

      const result = detectWorkspace(testDir)
      expect(result.type).toBe('pnpm')
      expect(result.root).toBe(testDir)
      expect(result.patterns).toContain('packages/*')
      expect(result.packages).toHaveLength(1)
      expect(result.packages[0]?.name).toBe('@scope/pkg-a')
    })

    it('detects npm workspace from package.json', () => {
      // Create package.json with workspaces
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'monorepo',
          workspaces: ['packages/*'],
        })
      )

      // Create a package
      const pkgDir = join(testDir, 'packages', 'my-lib')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(
        join(pkgDir, 'package.json'),
        JSON.stringify({ name: 'my-lib' })
      )

      const result = detectWorkspace(testDir)
      expect(result.type).toBe('npm')
      expect(result.packages).toHaveLength(1)
      expect(result.packages[0]?.name).toBe('my-lib')
    })

    it('detects yarn workspace format with packages object', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'yarn-monorepo',
          workspaces: {
            packages: ['apps/*', 'libs/*'],
          },
        })
      )

      // Create packages
      const appDir = join(testDir, 'apps', 'web')
      mkdirSync(appDir, { recursive: true })
      writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: '@app/web' }))

      const libDir = join(testDir, 'libs', 'utils')
      mkdirSync(libDir, { recursive: true })
      writeFileSync(join(libDir, 'package.json'), JSON.stringify({ name: '@lib/utils' }))

      const result = detectWorkspace(testDir)
      expect(result.type).toBe('npm')
      expect(result.packages).toHaveLength(2)
      expect(result.packages.map((p) => p.name).sort()).toEqual(['@app/web', '@lib/utils'])
    })

    it('handles multiple workspace patterns', () => {
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        'packages:\n  - "apps/*"\n  - "packages/*"\n  - "tools/cli"\n'
      )

      // Create packages in different locations
      const dirs = [
        { path: 'apps/frontend', name: 'frontend' },
        { path: 'packages/shared', name: 'shared' },
        { path: 'tools/cli', name: 'cli-tool' },
      ]

      for (const { path, name } of dirs) {
        const dir = join(testDir, path)
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ name }))
      }

      const result = detectWorkspace(testDir)
      expect(result.packages).toHaveLength(3)
    })

    it('detects workspace from subdirectory', () => {
      // Create workspace at root
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        'packages:\n  - "packages/*"\n'
      )

      // Create a package
      const pkgDir = join(testDir, 'packages', 'core')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'core' }))

      // Detect from within the package
      const result = detectWorkspace(pkgDir)
      expect(result.type).toBe('pnpm')
      expect(result.root).toBe(testDir)
    })

    it('skips negation patterns', () => {
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        'packages:\n  - "packages/*"\n  - "!packages/private"\n'
      )

      const pubDir = join(testDir, 'packages', 'public')
      mkdirSync(pubDir, { recursive: true })
      writeFileSync(join(pubDir, 'package.json'), JSON.stringify({ name: 'public' }))

      const result = detectWorkspace(testDir)
      expect(result.patterns).toContain('packages/*')
      // The implementation skips negation patterns during resolution
    })
  })

  describe('findWorkspacePackage', () => {
    it('finds package by name', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'utils')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: '@scope/utils' }))

      const workspace = detectWorkspace(testDir)
      const found = findWorkspacePackage(workspace, '@scope/utils')
      expect(found).toBeDefined()
      expect(found?.name).toBe('@scope/utils')
    })

    it('returns undefined for non-existent package', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const workspace = detectWorkspace(testDir)
      const found = findWorkspacePackage(workspace, 'non-existent')
      expect(found).toBeUndefined()
    })
  })

  describe('isWorkspaceImport', () => {
    it('identifies workspace package imports', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'core')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: '@my/core' }))

      const workspace = detectWorkspace(testDir)

      expect(isWorkspaceImport(workspace, '@my/core')).toBe(true)
      expect(isWorkspaceImport(workspace, '@my/core/utils')).toBe(true)
      expect(isWorkspaceImport(workspace, 'lodash')).toBe(false)
      expect(isWorkspaceImport(workspace, '@other/pkg')).toBe(false)
    })

    it('returns false for none workspace type', () => {
      const workspace = detectWorkspace(testDir) // No workspace config
      expect(isWorkspaceImport(workspace, 'any-import')).toBe(false)
    })
  })

  describe('resolveWorkspaceImport', () => {
    it('resolves package entry point', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'utils')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'utils' }))

      // Create entry point
      mkdirSync(join(pkgDir, 'src'), { recursive: true })
      writeFileSync(join(pkgDir, 'src', 'index.ts'), 'export const foo = 1')

      const workspace = detectWorkspace(testDir)
      const resolved = resolveWorkspaceImport(workspace, 'utils')

      expect(resolved).toBe(join(pkgDir, 'src', 'index.ts'))
    })

    it('resolves subpath imports', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'lib')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: '@scope/lib' }))

      // Create subpath
      mkdirSync(join(pkgDir, 'utils'), { recursive: true })
      writeFileSync(join(pkgDir, 'utils', 'index.ts'), 'export const helper = 1')

      const workspace = detectWorkspace(testDir)
      const resolved = resolveWorkspaceImport(workspace, '@scope/lib/utils')

      expect(resolved).toBe(join(pkgDir, 'utils', 'index.ts'))
    })

    it('returns null for non-workspace import', () => {
      const workspace = detectWorkspace(testDir)
      expect(resolveWorkspaceImport(workspace, 'lodash')).toBeNull()
    })

    it('respects package.json exports field', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'modern')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(
        join(pkgDir, 'package.json'),
        JSON.stringify({
          name: 'modern',
          exports: {
            '.': './src/main.ts',
          },
        })
      )

      mkdirSync(join(pkgDir, 'src'), { recursive: true })
      writeFileSync(join(pkgDir, 'src', 'main.ts'), 'export default {}')

      const workspace = detectWorkspace(testDir)
      const resolved = resolveWorkspaceImport(workspace, 'modern')

      expect(resolved).toBe(join(pkgDir, 'src', 'main.ts'))
    })
  })

  describe('pnpm-workspace.yaml parsing', () => {
    it('handles quoted patterns', () => {
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        `packages:
  - 'apps/*'
  - "libs/*"
`
      )

      const pkgDir = join(testDir, 'apps', 'web')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'web' }))

      const result = detectWorkspace(testDir)
      expect(result.patterns).toContain('apps/*')
      expect(result.patterns).toContain('libs/*')
    })

    it('handles comments', () => {
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        `# Workspace packages
packages:
  # Apps
  - 'apps/*'
  # Shared libraries
  - 'libs/*'
`
      )

      const result = detectWorkspace(testDir)
      expect(result.patterns).toContain('apps/*')
      expect(result.patterns).toContain('libs/*')
    })

    it('stops parsing at next top-level key', () => {
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        `packages:
  - 'apps/*'
catalog:
  lodash: ^4.0.0
`
      )

      const pkgDir = join(testDir, 'apps', 'web')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'web' }))

      const result = detectWorkspace(testDir)
      expect(result.patterns).toContain('apps/*')
      expect(result.patterns).toHaveLength(1)
    })

    it('handles invalid yaml gracefully', () => {
      writeFileSync(join(testDir, 'pnpm-workspace.yaml'), '{{{invalid yaml')

      const result = detectWorkspace(testDir)
      expect(result.type).toBe('pnpm')
      expect(result.patterns).toHaveLength(0)
    })
  })

  describe('recursive patterns (**)', () => {
    it('handles ** recursive patterns', () => {
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        `packages:
  - 'packages/**'
`
      )

      // Create nested packages
      const nestedDir = join(testDir, 'packages', 'nested', 'deep')
      mkdirSync(nestedDir, { recursive: true })
      writeFileSync(join(nestedDir, 'package.json'), JSON.stringify({ name: 'deep-pkg' }))

      const topDir = join(testDir, 'packages', 'top')
      mkdirSync(topDir, { recursive: true })
      writeFileSync(join(topDir, 'package.json'), JSON.stringify({ name: 'top-pkg' }))

      const result = detectWorkspace(testDir)
      expect(result.packages.map((p) => p.name).sort()).toEqual(['deep-pkg', 'top-pkg'])
    })

    it('handles ** pattern with non-existent base dir', () => {
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        `packages:
  - 'nonexistent/**'
`
      )

      const result = detectWorkspace(testDir)
      expect(result.packages).toHaveLength(0)
    })
  })

  describe('resolveWorkspaceImport edge cases', () => {
    it('resolves using package.json main field', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'legacy')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(
        join(pkgDir, 'package.json'),
        JSON.stringify({ name: 'legacy', main: './dist/index.js' })
      )

      mkdirSync(join(pkgDir, 'dist'), { recursive: true })
      writeFileSync(join(pkgDir, 'dist', 'index.js'), 'module.exports = {}')

      const workspace = detectWorkspace(testDir)
      const resolved = resolveWorkspaceImport(workspace, 'legacy')

      expect(resolved).toBe(join(pkgDir, 'dist', 'index.js'))
    })

    it('resolves using package.json module field', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'esm')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(
        join(pkgDir, 'package.json'),
        JSON.stringify({ name: 'esm', module: './esm/index.js' })
      )

      mkdirSync(join(pkgDir, 'esm'), { recursive: true })
      writeFileSync(join(pkgDir, 'esm', 'index.js'), 'export default {}')

      const workspace = detectWorkspace(testDir)
      const resolved = resolveWorkspaceImport(workspace, 'esm')

      expect(resolved).toBe(join(pkgDir, 'esm', 'index.js'))
    })

    it('resolves package.json exports with import condition', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'dual')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(
        join(pkgDir, 'package.json'),
        JSON.stringify({
          name: 'dual',
          exports: {
            '.': {
              import: './esm/index.js',
              require: './cjs/index.js',
            },
          },
        })
      )

      mkdirSync(join(pkgDir, 'esm'), { recursive: true })
      writeFileSync(join(pkgDir, 'esm', 'index.js'), 'export default {}')

      const workspace = detectWorkspace(testDir)
      const resolved = resolveWorkspaceImport(workspace, 'dual')

      expect(resolved).toBe(join(pkgDir, 'esm', 'index.js'))
    })

    it('resolves subpath imports with direct file', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'lib')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: '@scope/lib' }))

      // Create direct file (not in folder with index)
      writeFileSync(join(pkgDir, 'helper.ts'), 'export const helper = 1')

      const workspace = detectWorkspace(testDir)
      const resolved = resolveWorkspaceImport(workspace, '@scope/lib/helper')

      expect(resolved).toBe(join(pkgDir, 'helper.ts'))
    })

    it('resolves json file imports directly', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'config')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'config' }))
      writeFileSync(join(pkgDir, 'settings.json'), JSON.stringify({ key: 'value' }))

      const workspace = detectWorkspace(testDir)
      const resolved = resolveWorkspaceImport(workspace, 'config/settings.json')

      expect(resolved).toBe(join(pkgDir, 'settings.json'))
    })

    it('returns null when no entry point found', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'empty')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'empty' }))
      // No entry point files

      const workspace = detectWorkspace(testDir)
      const resolved = resolveWorkspaceImport(workspace, 'empty')

      expect(resolved).toBeNull()
    })

    it('returns null for unresolvable subpath', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'lib')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'lib' }))

      const workspace = detectWorkspace(testDir)
      const resolved = resolveWorkspaceImport(workspace, 'lib/nonexistent')

      expect(resolved).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('skips directories starting with dot', () => {
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        `packages:
  - 'packages/*'
`
      )

      // Create a hidden directory
      const hiddenDir = join(testDir, 'packages', '.hidden')
      mkdirSync(hiddenDir, { recursive: true })
      writeFileSync(join(hiddenDir, 'package.json'), JSON.stringify({ name: 'hidden' }))

      // Create a normal package
      const normalDir = join(testDir, 'packages', 'normal')
      mkdirSync(normalDir, { recursive: true })
      writeFileSync(join(normalDir, 'package.json'), JSON.stringify({ name: 'normal' }))

      const result = detectWorkspace(testDir)
      expect(result.packages).toHaveLength(1)
      expect(result.packages[0]?.name).toBe('normal')
    })

    it('handles package.json without name field', () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ workspaces: ['packages/*'] })
      )

      const pkgDir = join(testDir, 'packages', 'unnamed')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ version: '1.0.0' }))

      const result = detectWorkspace(testDir)
      expect(result.packages).toHaveLength(0) // Skipped because no name
    })

    it('handles duplicate package paths', () => {
      writeFileSync(
        join(testDir, 'pnpm-workspace.yaml'),
        `packages:
  - 'packages/*'
  - 'packages/core'
`
      )

      const pkgDir = join(testDir, 'packages', 'core')
      mkdirSync(pkgDir, { recursive: true })
      writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ name: 'core' }))

      const result = detectWorkspace(testDir)
      expect(result.packages).toHaveLength(1) // De-duplicated
    })
  })
})
