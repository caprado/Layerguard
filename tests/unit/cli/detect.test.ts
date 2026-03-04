import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  detectFramework,
  scanForLayers,
  suggestFlowRules,
  shouldBeIsolated,
  COMMON_LAYER_PATTERNS,
} from '../../../src/cli/detect.js'

describe('detectFramework', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archgate-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('detects Next.js App Router when next.config.js and app/ exist', () => {
    fs.writeFileSync(path.join(tempDir, 'next.config.js'), 'module.exports = {}')
    fs.mkdirSync(path.join(tempDir, 'app'))

    const result = detectFramework(tempDir)

    expect(result.framework).toBe('nextjs-app')
    expect(result.details).toContain('Next.js App Router')
  })

  it('detects Next.js App Router when src/app exists', () => {
    fs.writeFileSync(path.join(tempDir, 'next.config.js'), 'module.exports = {}')
    fs.mkdirSync(path.join(tempDir, 'src', 'app'), { recursive: true })

    const result = detectFramework(tempDir)

    expect(result.framework).toBe('nextjs-app')
  })

  it('detects Next.js Pages Router when pages/ exists', () => {
    fs.writeFileSync(path.join(tempDir, 'next.config.js'), 'module.exports = {}')
    fs.mkdirSync(path.join(tempDir, 'pages'))

    const result = detectFramework(tempDir)

    expect(result.framework).toBe('nextjs-pages')
    expect(result.details).toContain('Pages Router')
  })

  it('detects Vite project', () => {
    fs.writeFileSync(path.join(tempDir, 'vite.config.ts'), 'export default {}')

    const result = detectFramework(tempDir)

    expect(result.framework).toBe('vite-react')
    expect(result.details).toContain('Vite')
  })

  it('detects Angular project', () => {
    fs.writeFileSync(path.join(tempDir, 'angular.json'), '{}')

    const result = detectFramework(tempDir)

    expect(result.framework).toBe('angular')
    expect(result.details).toContain('Angular')
  })

  it('detects TypeScript project', () => {
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}')

    const result = detectFramework(tempDir)

    expect(result.isTypeScript).toBe(true)
  })

  it('detects Next.js from package.json', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ dependencies: { next: '^14.0.0' } })
    )
    fs.mkdirSync(path.join(tempDir, 'app'))

    const result = detectFramework(tempDir)

    expect(result.framework).toBe('nextjs-app')
    expect(result.details).toContain('package.json')
  })

  it('detects Node.js backend from package.json', () => {
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ dependencies: { express: '^4.0.0' } })
    )

    const result = detectFramework(tempDir)

    expect(result.framework).toBe('node')
    expect(result.details).toContain('Node.js')
  })

  it('returns unknown for empty project', () => {
    const result = detectFramework(tempDir)

    expect(result.framework).toBe('unknown')
    expect(result.details).toContain('No specific framework detected')
  })
})

describe('scanForLayers', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archgate-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('finds directories in project root', () => {
    fs.mkdirSync(path.join(tempDir, 'components'))
    fs.writeFileSync(path.join(tempDir, 'components', 'Button.tsx'), '')
    fs.mkdirSync(path.join(tempDir, 'hooks'))
    fs.writeFileSync(path.join(tempDir, 'hooks', 'useFetch.ts'), '')

    const results = scanForLayers(tempDir)

    expect(results.some((r) => r.name === 'components')).toBe(true)
    expect(results.some((r) => r.name === 'hooks')).toBe(true)
  })

  it('finds directories in src/', () => {
    fs.mkdirSync(path.join(tempDir, 'src', 'components'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'src', 'components', 'Button.tsx'), '')

    const results = scanForLayers(tempDir)

    expect(results.some((r) => r.path === 'src/components')).toBe(true)
  })

  it('ignores node_modules', () => {
    fs.mkdirSync(path.join(tempDir, 'node_modules', 'react'), { recursive: true })
    fs.writeFileSync(path.join(tempDir, 'node_modules', 'react', 'index.js'), '')

    const results = scanForLayers(tempDir)

    expect(results.some((r) => r.name === 'node_modules')).toBe(false)
    expect(results.some((r) => r.name === 'react')).toBe(false)
  })

  it('ignores hidden directories', () => {
    fs.mkdirSync(path.join(tempDir, '.git'))
    fs.writeFileSync(path.join(tempDir, '.git', 'config'), '')

    const results = scanForLayers(tempDir)

    expect(results.some((r) => r.name === '.git')).toBe(false)
  })

  it('marks common patterns', () => {
    fs.mkdirSync(path.join(tempDir, 'components'))
    fs.writeFileSync(path.join(tempDir, 'components', 'Button.tsx'), '')
    fs.mkdirSync(path.join(tempDir, 'randomdir'))
    fs.writeFileSync(path.join(tempDir, 'randomdir', 'file.ts'), '')

    const results = scanForLayers(tempDir)
    const components = results.find((r) => r.name === 'components')
    const randomdir = results.find((r) => r.name === 'randomdir')

    expect(components?.isCommon).toBe(true)
    expect(randomdir?.isCommon).toBe(false)
  })

  it('finds subdirectories', () => {
    fs.mkdirSync(path.join(tempDir, 'components', 'features'), { recursive: true })
    fs.mkdirSync(path.join(tempDir, 'components', 'shared'))
    fs.writeFileSync(path.join(tempDir, 'components', 'Button.tsx'), '')

    const results = scanForLayers(tempDir)
    const components = results.find((r) => r.name === 'components')

    expect(components?.subdirs).toContain('features')
    expect(components?.subdirs).toContain('shared')
  })

  it('counts source files', () => {
    fs.mkdirSync(path.join(tempDir, 'components'))
    fs.writeFileSync(path.join(tempDir, 'components', 'Button.tsx'), '')
    fs.writeFileSync(path.join(tempDir, 'components', 'Input.tsx'), '')
    fs.writeFileSync(path.join(tempDir, 'components', 'README.md'), '')

    const results = scanForLayers(tempDir)
    const components = results.find((r) => r.name === 'components')

    expect(components?.fileCount).toBe(2)
  })
})

describe('suggestFlowRules', () => {
  it('suggests flow rules for common layer combinations', () => {
    const rules = suggestFlowRules(['components', 'hooks', 'utils'])

    expect(rules).toContain('components -> hooks')
    expect(rules).toContain('components -> utils')
    expect(rules).toContain('hooks -> utils')
  })

  it('suggests bidirectional rules for hooks and stores', () => {
    const rules = suggestFlowRules(['hooks', 'stores', 'utils'])

    expect(rules).toContain('hooks <-> stores')
  })

  it('returns empty array for unrecognized layers', () => {
    const rules = suggestFlowRules(['foo', 'bar', 'baz'])

    expect(rules).toHaveLength(0)
  })

  it('only includes rules for layers that exist', () => {
    const rules = suggestFlowRules(['components', 'hooks'])

    expect(rules).toContain('components -> hooks')
    expect(rules).not.toContain('components -> utils')
    expect(rules).not.toContain('hooks -> utils')
  })
})

describe('shouldBeIsolated', () => {
  it('returns true for features', () => {
    expect(shouldBeIsolated('features')).toBe(true)
  })

  it('returns true for modules', () => {
    expect(shouldBeIsolated('modules')).toBe(true)
  })

  it('returns true for domains', () => {
    expect(shouldBeIsolated('domains')).toBe(true)
  })

  it('returns false for shared', () => {
    expect(shouldBeIsolated('shared')).toBe(false)
  })

  it('returns false for components', () => {
    expect(shouldBeIsolated('components')).toBe(false)
  })
})

describe('COMMON_LAYER_PATTERNS', () => {
  it('includes common directory names', () => {
    expect(COMMON_LAYER_PATTERNS).toContain('components')
    expect(COMMON_LAYER_PATTERNS).toContain('hooks')
    expect(COMMON_LAYER_PATTERNS).toContain('utils')
    expect(COMMON_LAYER_PATTERNS).toContain('services')
    expect(COMMON_LAYER_PATTERNS).toContain('types')
  })
})
