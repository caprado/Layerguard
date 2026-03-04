import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  generateConfigContent,
  writeConfigFile,
  configFileExists,
} from '../../../src/cli/generator.js'
import type { ArchgateConfig } from '../../../src/config/types.js'

describe('generateConfigContent', () => {
  const basicConfig: ArchgateConfig = {
    layers: {
      components: { path: 'src/components' },
      hooks: { path: 'src/hooks' },
    },
    flow: ['components -> hooks'],
  }

  it('generates TypeScript config by default', () => {
    const content = generateConfigContent(basicConfig)

    expect(content).toContain("import { defineConfig } from 'archgate'")
    expect(content).toContain('export default defineConfig({')
  })

  it('generates JavaScript config when typescript is false', () => {
    const content = generateConfigContent(basicConfig, { typescript: false })

    expect(content).toContain('@ts-check')
    expect(content).toContain('module.exports = {')
    expect(content).not.toContain('export default')
  })

  it('includes layers configuration', () => {
    const content = generateConfigContent(basicConfig)

    expect(content).toContain('layers: {')
    expect(content).toContain("components: { path: 'src/components' }")
    expect(content).toContain("hooks: { path: 'src/hooks' }")
  })

  it('includes flow rules', () => {
    const content = generateConfigContent(basicConfig)

    expect(content).toContain('flow: [')
    expect(content).toContain("'components -> hooks'")
  })

  it('includes framework when set', () => {
    const configWithFramework: ArchgateConfig = {
      ...basicConfig,
      framework: 'nextjs-app',
    }

    const content = generateConfigContent(configWithFramework)

    expect(content).toContain("framework: 'nextjs-app'")
  })

  it('includes rules when set', () => {
    const configWithRules: ArchgateConfig = {
      ...basicConfig,
      rules: {
        circular: 'error',
        typeOnlyImports: 'ignore',
      },
    }

    const content = generateConfigContent(configWithRules)

    expect(content).toContain('rules: {')
    expect(content).toContain("circular: 'error'")
    expect(content).toContain("typeOnlyImports: 'ignore'")
  })

  it('includes ignore patterns when set', () => {
    const configWithIgnore: ArchgateConfig = {
      ...basicConfig,
      ignore: ['**/*.test.ts', 'dist/**'],
    }

    const content = generateConfigContent(configWithIgnore)

    expect(content).toContain('ignore: [')
    expect(content).toContain("'**/*.test.ts'")
    expect(content).toContain("'dist/**'")
  })

  it('includes comments by default', () => {
    const content = generateConfigContent(basicConfig)

    expect(content).toContain('// Define your architectural layers')
    expect(content).toContain('// Dependency flow rules')
  })

  it('excludes comments when includeComments is false', () => {
    const content = generateConfigContent(basicConfig, { includeComments: false })

    expect(content).not.toContain('// Define')
    expect(content).not.toContain('// Dependency')
  })

  it('handles complex layer with sublayers', () => {
    const config: ArchgateConfig = {
      layers: {
        components: {
          path: 'src/components',
          sublayers: {
            features: { path: 'features', isolated: true },
            shared: { path: 'shared' },
          },
          flow: ['features -> shared'],
        },
      },
      flow: [],
    }

    const content = generateConfigContent(config)

    expect(content).toContain('sublayers: {')
    expect(content).toContain("features: { path: 'features', isolated: true }")
    expect(content).toContain("shared: { path: 'shared' }")
    expect(content).toContain("flow: ['features -> shared']")
  })

  it('produces valid TypeScript syntax', () => {
    const content = generateConfigContent(basicConfig)

    // Check proper closing brackets
    expect(content.match(/\{/g)?.length).toBe(content.match(/\}/g)?.length)
    // Check proper parentheses for defineConfig
    expect(content).toMatch(/defineConfig\(\{[\s\S]*\}\)/)
  })
})

describe('writeConfigFile', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archgate-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('writes TypeScript config file', () => {
    const config: ArchgateConfig = {
      layers: { components: { path: 'src/components' } },
      flow: [],
    }

    const filepath = writeConfigFile(tempDir, config, { typescript: true })

    expect(filepath).toBe(path.join(tempDir, 'archgate.config.ts'))
    expect(fs.existsSync(filepath)).toBe(true)

    const content = fs.readFileSync(filepath, 'utf-8')
    expect(content).toContain('defineConfig')
  })

  it('writes JavaScript config file', () => {
    const config: ArchgateConfig = {
      layers: { components: { path: 'src/components' } },
      flow: [],
    }

    const filepath = writeConfigFile(tempDir, config, { typescript: false })

    expect(filepath).toBe(path.join(tempDir, 'archgate.config.js'))
    expect(fs.existsSync(filepath)).toBe(true)

    const content = fs.readFileSync(filepath, 'utf-8')
    expect(content).toContain('module.exports')
  })
})

describe('configFileExists', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archgate-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('returns null when no config exists', () => {
    const result = configFileExists(tempDir)

    expect(result).toBeNull()
  })

  it('returns filename when archgate.config.ts exists', () => {
    fs.writeFileSync(path.join(tempDir, 'archgate.config.ts'), '')

    const result = configFileExists(tempDir)

    expect(result).toBe('archgate.config.ts')
  })

  it('returns filename when archgate.config.js exists', () => {
    fs.writeFileSync(path.join(tempDir, 'archgate.config.js'), '')

    const result = configFileExists(tempDir)

    expect(result).toBe('archgate.config.js')
  })

  it('returns first match when multiple configs exist', () => {
    // .ts should be checked first
    fs.writeFileSync(path.join(tempDir, 'archgate.config.ts'), '')
    fs.writeFileSync(path.join(tempDir, 'archgate.config.js'), '')

    const result = configFileExists(tempDir)

    expect(result).toBe('archgate.config.ts')
  })

  it('returns .mjs config when it exists', () => {
    fs.writeFileSync(path.join(tempDir, 'archgate.config.mjs'), '')

    const result = configFileExists(tempDir)

    expect(result).toBe('archgate.config.mjs')
  })
})
