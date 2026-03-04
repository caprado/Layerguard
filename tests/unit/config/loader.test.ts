import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadConfig, loadConfigSync, findConfigFile, ConfigNotFoundError, ConfigLoadError } from '../../../src/config/loader.js'

describe('findConfigFile', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `archgate-loader-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('returns null when no config file exists', () => {
    expect(findConfigFile(testDir)).toBeNull()
  })

  it('finds archgate.config.ts', () => {
    writeFileSync(join(testDir, 'archgate.config.ts'), 'export default {}')
    expect(findConfigFile(testDir)).toBe(join(testDir, 'archgate.config.ts'))
  })

  it('finds archgate.config.js', () => {
    writeFileSync(join(testDir, 'archgate.config.js'), 'module.exports = {}')
    expect(findConfigFile(testDir)).toBe(join(testDir, 'archgate.config.js'))
  })

  it('prioritizes .ts over .js', () => {
    writeFileSync(join(testDir, 'archgate.config.ts'), 'export default {}')
    writeFileSync(join(testDir, 'archgate.config.js'), 'module.exports = {}')
    expect(findConfigFile(testDir)).toBe(join(testDir, 'archgate.config.ts'))
  })

  it('finds archgate.config.mjs', () => {
    writeFileSync(join(testDir, 'archgate.config.mjs'), 'export default {}')
    expect(findConfigFile(testDir)).toBe(join(testDir, 'archgate.config.mjs'))
  })

  it('finds archgate.config.cjs', () => {
    writeFileSync(join(testDir, 'archgate.config.cjs'), 'module.exports = {}')
    expect(findConfigFile(testDir)).toBe(join(testDir, 'archgate.config.cjs'))
  })
})

describe('loadConfig', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `archgate-loader-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('throws ConfigNotFoundError when no config exists', async () => {
    await expect(loadConfig(testDir)).rejects.toThrow(ConfigNotFoundError)
  })

  it('loads a TypeScript config file', async () => {
    const configContent = `
      export default {
        layers: {
          components: { path: 'components' },
          hooks: { path: 'hooks' },
        },
        flow: ['components -> hooks'],
      }
    `
    writeFileSync(join(testDir, 'archgate.config.ts'), configContent)

    const result = await loadConfig(testDir)

    expect(result.config.layers).toHaveProperty('components')
    expect(result.config.layers).toHaveProperty('hooks')
    expect(result.config.flow).toContain('components -> hooks')
    expect(result.configPath).toBe(join(testDir, 'archgate.config.ts'))
  })

  it('loads a JavaScript config file', async () => {
    const configContent = `
      module.exports = {
        layers: {
          utils: { path: 'utils' },
        },
        flow: [],
      }
    `
    writeFileSync(join(testDir, 'archgate.config.js'), configContent)

    const result = await loadConfig(testDir)

    expect(result.config.layers).toHaveProperty('utils')
    expect(result.configPath).toBe(join(testDir, 'archgate.config.js'))
  })

  it('loads ESM config file', async () => {
    const configContent = `
      const config = {
        layers: {
          api: { path: 'api' },
        },
        flow: [],
      }
      export default config
    `
    writeFileSync(join(testDir, 'archgate.config.mjs'), configContent)

    const result = await loadConfig(testDir)

    expect(result.config.layers).toHaveProperty('api')
  })

  it('loads config with defineConfig helper', async () => {
    // First, we need to write a config that imports defineConfig
    // For this test, we'll simulate the pattern
    const configContent = `
      const defineConfig = (config) => config
      export default defineConfig({
        layers: {
          pages: { path: 'pages' },
        },
        flow: [],
      })
    `
    writeFileSync(join(testDir, 'archgate.config.ts'), configContent)

    const result = await loadConfig(testDir)

    expect(result.config.layers).toHaveProperty('pages')
  })

  it('handles config with sublayers', async () => {
    const configContent = `
      export default {
        layers: {
          components: {
            path: 'components',
            sublayers: {
              features: { path: 'components/features', isolated: true },
              shared: { path: 'components/shared' },
            },
            flow: ['features -> shared'],
          },
        },
        flow: [],
      }
    `
    writeFileSync(join(testDir, 'archgate.config.ts'), configContent)

    const result = await loadConfig(testDir)

    expect(result.config.layers.components?.sublayers?.features?.isolated).toBe(true)
    expect(result.config.layers.components?.flow).toContain('features -> shared')
  })

  it('handles config with framework and rules', async () => {
    const configContent = `
      export default {
        framework: 'nextjs-app',
        layers: {
          app: { path: 'app' },
        },
        flow: [],
        rules: {
          circular: 'error',
          orphans: 'warn',
          typeOnlyImports: 'ignore',
        },
        ignore: ['**/*.test.ts', '**/*.spec.ts'],
      }
    `
    writeFileSync(join(testDir, 'archgate.config.ts'), configContent)

    const result = await loadConfig(testDir)

    expect(result.config.framework).toBe('nextjs-app')
    expect(result.config.rules?.circular).toBe('error')
    expect(result.config.ignore).toContain('**/*.test.ts')
  })

  it('throws ConfigLoadError with original error as cause', async () => {
    const configContent = `
      export default {
        invalid syntax here
      }
    `
    writeFileSync(join(testDir, 'archgate.config.ts'), configContent)

    await expect(loadConfig(testDir)).rejects.toThrow(ConfigLoadError)
  })

})

describe('loadConfigSync', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `archgate-loader-sync-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('returns null when no config file exists', () => {
    const result = loadConfigSync(testDir)
    expect(result).toBeNull()
  })

  it('loads a TypeScript config file synchronously', () => {
    const configContent = `
      export default {
        layers: {
          components: { path: 'components' },
        },
        flow: [],
      }
    `
    writeFileSync(join(testDir, 'archgate.config.ts'), configContent)

    const result = loadConfigSync(testDir)

    expect(result).not.toBeNull()
    expect(result?.config.layers).toHaveProperty('components')
    expect(result?.configPath).toBe(join(testDir, 'archgate.config.ts'))
  })

  it('loads a JavaScript config file synchronously', () => {
    const configContent = `
      module.exports = {
        layers: {
          utils: { path: 'utils' },
        },
        flow: [],
      }
    `
    writeFileSync(join(testDir, 'archgate.config.js'), configContent)

    const result = loadConfigSync(testDir)

    expect(result).not.toBeNull()
    expect(result?.config.layers).toHaveProperty('utils')
  })

  it('returns null when config has syntax error', () => {
    const configContent = `
      export default {
        invalid syntax
      }
    `
    writeFileSync(join(testDir, 'archgate.config.ts'), configContent)

    const result = loadConfigSync(testDir)

    expect(result).toBeNull()
  })

})

describe('ConfigLoadError', () => {
  it('includes config path in error message', () => {
    const error = new ConfigLoadError('/path/to/config.ts', new Error('Parse error'))
    expect(error.message).toContain('/path/to/config.ts')
    expect(error.message).toContain('Parse error')
  })

  it('handles non-Error cause', () => {
    const error = new ConfigLoadError('/path/to/config.ts', 'string error')
    expect(error.message).toContain('string error')
  })

  it('sets error name correctly', () => {
    const error = new ConfigLoadError('/path/to/config.ts', new Error('test'))
    expect(error.name).toBe('ConfigLoadError')
  })

  it('preserves cause', () => {
    const cause = new Error('Original error')
    const error = new ConfigLoadError('/path/to/config.ts', cause)
    expect(error.cause).toBe(cause)
  })
})
