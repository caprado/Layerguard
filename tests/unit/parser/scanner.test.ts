import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scanDirectory, getRelativePath, DEFAULT_IGNORE_PATTERNS } from '../../../src/parser/scanner.js'

describe('scanDirectory', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `archgate-scanner-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('finds TypeScript files', () => {
    writeFileSync(join(testDir, 'index.ts'), 'export {}')
    writeFileSync(join(testDir, 'component.tsx'), 'export {}')

    const result = scanDirectory({ root: testDir })

    expect(result.files).toHaveLength(2)
    expect(result.files.some((f) => f.endsWith('index.ts'))).toBe(true)
    expect(result.files.some((f) => f.endsWith('component.tsx'))).toBe(true)
  })

  it('finds JavaScript files', () => {
    writeFileSync(join(testDir, 'index.js'), 'export {}')
    writeFileSync(join(testDir, 'component.jsx'), 'export {}')

    const result = scanDirectory({ root: testDir })

    expect(result.files).toHaveLength(2)
  })

  it('ignores node_modules by default', () => {
    mkdirSync(join(testDir, 'node_modules', 'some-package'), { recursive: true })
    writeFileSync(join(testDir, 'node_modules', 'some-package', 'index.js'), 'export {}')
    writeFileSync(join(testDir, 'index.ts'), 'export {}')

    const result = scanDirectory({ root: testDir })

    expect(result.files).toHaveLength(1)
    expect(result.skippedDirs.some((d) => d.includes('node_modules'))).toBe(true)
  })

  it('ignores .next directory by default', () => {
    mkdirSync(join(testDir, '.next', 'cache'), { recursive: true })
    writeFileSync(join(testDir, '.next', 'cache', 'file.js'), 'export {}')
    writeFileSync(join(testDir, 'index.ts'), 'export {}')

    const result = scanDirectory({ root: testDir })

    expect(result.files).toHaveLength(1)
  })

  it('ignores dist directory by default', () => {
    mkdirSync(join(testDir, 'dist'), { recursive: true })
    writeFileSync(join(testDir, 'dist', 'index.js'), 'export {}')
    writeFileSync(join(testDir, 'index.ts'), 'export {}')

    const result = scanDirectory({ root: testDir })

    expect(result.files).toHaveLength(1)
  })

  it('skips test files by default', () => {
    writeFileSync(join(testDir, 'index.ts'), 'export {}')
    writeFileSync(join(testDir, 'index.test.ts'), 'export {}')
    writeFileSync(join(testDir, 'index.spec.ts'), 'export {}')

    const result = scanDirectory({ root: testDir })

    expect(result.files).toHaveLength(1)
    expect(result.skipped).toHaveLength(2)
  })

  it('includes test files when requested', () => {
    writeFileSync(join(testDir, 'index.ts'), 'export {}')
    writeFileSync(join(testDir, 'index.test.ts'), 'export {}')

    const result = scanDirectory({ root: testDir, includeTests: true })

    expect(result.files).toHaveLength(2)
  })

  it('skips declaration files by default', () => {
    writeFileSync(join(testDir, 'index.ts'), 'export {}')
    writeFileSync(join(testDir, 'types.d.ts'), 'export {}')

    const result = scanDirectory({ root: testDir })

    expect(result.files).toHaveLength(1)
    expect(result.skipped).toHaveLength(1)
  })

  it('includes declaration files when requested', () => {
    writeFileSync(join(testDir, 'index.ts'), 'export {}')
    writeFileSync(join(testDir, 'types.d.ts'), 'export {}')

    const result = scanDirectory({ root: testDir, includeDeclarations: true })

    expect(result.files).toHaveLength(2)
  })

  it('respects custom ignore patterns', () => {
    mkdirSync(join(testDir, 'generated'), { recursive: true })
    writeFileSync(join(testDir, 'generated', 'file.ts'), 'export {}')
    writeFileSync(join(testDir, 'index.ts'), 'export {}')

    const result = scanDirectory({ root: testDir, ignore: ['generated'] })

    expect(result.files).toHaveLength(1)
  })

  it('handles glob patterns in ignore', () => {
    writeFileSync(join(testDir, 'index.ts'), 'export {}')
    writeFileSync(join(testDir, 'generated.ts'), 'export {}')

    const result = scanDirectory({ root: testDir, ignore: ['*.generated.ts', 'generated*'] })

    expect(result.files).toHaveLength(1)
  })

  it('scans nested directories', () => {
    mkdirSync(join(testDir, 'src', 'components'), { recursive: true })
    writeFileSync(join(testDir, 'src', 'index.ts'), 'export {}')
    writeFileSync(join(testDir, 'src', 'components', 'Button.tsx'), 'export {}')

    const result = scanDirectory({ root: testDir })

    expect(result.files).toHaveLength(2)
  })

  it('returns empty result for empty directory', () => {
    const result = scanDirectory({ root: testDir })

    expect(result.files).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
  })

  it('ignores non-source files', () => {
    writeFileSync(join(testDir, 'index.ts'), 'export {}')
    writeFileSync(join(testDir, 'readme.md'), '# Readme')
    writeFileSync(join(testDir, 'config.json'), '{}')
    writeFileSync(join(testDir, 'styles.css'), '.foo {}')

    const result = scanDirectory({ root: testDir })

    expect(result.files).toHaveLength(1)
  })
})

describe('getRelativePath', () => {
  it('returns relative path with forward slashes', () => {
    const root = '/project'
    const file = '/project/src/index.ts'

    expect(getRelativePath(root, file)).toBe('src/index.ts')
  })

  it('handles Windows paths', () => {
    const root = 'C:\\project'
    const file = 'C:\\project\\src\\index.ts'

    const result = getRelativePath(root, file)
    expect(result).toBe('src/index.ts')
  })
})

describe('DEFAULT_IGNORE_PATTERNS', () => {
  it('includes common ignore directories', () => {
    expect(DEFAULT_IGNORE_PATTERNS).toContain('node_modules')
    expect(DEFAULT_IGNORE_PATTERNS).toContain('.next')
    expect(DEFAULT_IGNORE_PATTERNS).toContain('dist')
    expect(DEFAULT_IGNORE_PATTERNS).toContain('build')
    expect(DEFAULT_IGNORE_PATTERNS).toContain('coverage')
    expect(DEFAULT_IGNORE_PATTERNS).toContain('.git')
  })
})
