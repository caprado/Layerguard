import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  extractImports,
  isExternalImport,
  isRelativeImport,
} from '../../../src/parser/extractor.js'

describe('extractImports', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `archgate-extractor-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('static imports', () => {
    it('extracts named imports', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(filePath, `import { foo, bar } from './utils'`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.specifier).toBe('./utils')
      expect(result.imports[0]?.kind).toBe('static')
      expect(result.imports[0]?.isTypeOnly).toBe(false)
    })

    it('extracts default imports', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(filePath, `import React from 'react'`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.specifier).toBe('react')
    })

    it('extracts namespace imports', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(filePath, `import * as utils from './utils'`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.specifier).toBe('./utils')
    })

    it('extracts side-effect imports', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(filePath, `import './styles.css'`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.specifier).toBe('./styles.css')
    })

    it('extracts multiple imports', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(
        filePath,
        `
        import { foo } from './foo'
        import { bar } from './bar'
        import baz from './baz'
      `
      )

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(3)
    })
  })

  describe('type-only imports', () => {
    it('identifies type-only imports', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(filePath, `import type { Type } from './types'`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.isTypeOnly).toBe(true)
    })

    it('excludes type-only imports when configured', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(
        filePath,
        `
        import type { Type } from './types'
        import { value } from './values'
      `
      )

      const result = extractImports(filePath, { includeTypeOnly: false })

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.specifier).toBe('./values')
    })
  })

  describe('dynamic imports', () => {
    it('extracts dynamic imports', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(filePath, `const mod = await import('./dynamic')`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.specifier).toBe('./dynamic')
      expect(result.imports[0]?.kind).toBe('dynamic')
    })

    it('excludes dynamic imports when configured', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(filePath, `const mod = await import('./dynamic')`)

      const result = extractImports(filePath, { includeDynamic: false })

      expect(result.imports).toHaveLength(0)
    })
  })

  describe('re-exports', () => {
    it('extracts re-exports', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(filePath, `export { foo } from './foo'`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.specifier).toBe('./foo')
      expect(result.imports[0]?.kind).toBe('reexport')
    })

    it('extracts export all', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(filePath, `export * from './all'`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.specifier).toBe('./all')
      expect(result.imports[0]?.kind).toBe('reexport')
    })

    it('identifies type-only re-exports', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(filePath, `export type { Type } from './types'`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.isTypeOnly).toBe(true)
    })
  })

  describe('require calls', () => {
    it('extracts require when enabled', () => {
      const filePath = join(testDir, 'test.js')
      writeFileSync(filePath, `const foo = require('./foo')`)

      const result = extractImports(filePath, { includeRequire: true })

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.specifier).toBe('./foo')
      expect(result.imports[0]?.kind).toBe('require')
    })

    it('extracts require by default', () => {
      const filePath = join(testDir, 'test.js')
      writeFileSync(filePath, `const foo = require('./foo')`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(1)
      expect(result.imports[0]?.kind).toBe('require')
    })

    it('ignores require when disabled', () => {
      const filePath = join(testDir, 'test.js')
      writeFileSync(filePath, `const foo = require('./foo')`)

      const result = extractImports(filePath, { includeRequire: false })

      expect(result.imports).toHaveLength(0)
    })

    it('ignores require with variable argument', () => {
      const filePath = join(testDir, 'test.js')
      writeFileSync(filePath, `const mod = './foo'; const foo = require(mod)`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(0)
    })

    it('extracts both import and require from mixed file', () => {
      const filePath = join(testDir, 'test.js')
      writeFileSync(filePath, `import { a } from './a'\nconst b = require('./b')`)

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(2)
      expect(result.imports[0]?.specifier).toBe('./a')
      expect(result.imports[0]?.kind).toBe('static')
      expect(result.imports[1]?.specifier).toBe('./b')
      expect(result.imports[1]?.kind).toBe('require')
    })
  })

  describe('line numbers', () => {
    it('reports correct line numbers', () => {
      const filePath = join(testDir, 'test.ts')
      writeFileSync(
        filePath,
        `// comment
import { foo } from './foo'
// another comment
import { bar } from './bar'`
      )

      const result = extractImports(filePath)

      expect(result.imports[0]?.line).toBe(2)
      expect(result.imports[1]?.line).toBe(4)
    })
  })

  describe('error handling', () => {
    it('returns error for non-existent file', () => {
      const result = extractImports(join(testDir, 'nonexistent.ts'))

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Failed to read file')
    })

    it('handles files with syntax errors gracefully', () => {
      const filePath = join(testDir, 'broken.ts')
      writeFileSync(filePath, `import { from './foo'`) // Missing identifier

      const result = extractImports(filePath)

      // Should not crash, but may or may not extract the import
      expect(result.errors).toBeDefined()
    })
  })

  describe('TSX files', () => {
    it('parses TSX correctly', () => {
      const filePath = join(testDir, 'component.tsx')
      writeFileSync(
        filePath,
        `
        import React from 'react'
        import { Button } from './Button'

        export function App() {
          return <Button>Click me</Button>
        }
      `
      )

      const result = extractImports(filePath)

      expect(result.imports).toHaveLength(2)
      expect(result.errors).toHaveLength(0)
    })
  })
})

describe('isExternalImport', () => {
  it('returns true for package imports', () => {
    expect(isExternalImport('react')).toBe(true)
    expect(isExternalImport('@org/package')).toBe(true)
    expect(isExternalImport('lodash/get')).toBe(true)
  })

  it('returns true for node: protocol', () => {
    expect(isExternalImport('node:fs')).toBe(true)
    expect(isExternalImport('node:path')).toBe(true)
  })

  it('returns false for relative imports', () => {
    expect(isExternalImport('./foo')).toBe(false)
    expect(isExternalImport('../bar')).toBe(false)
    expect(isExternalImport('../../baz')).toBe(false)
  })

  it('returns false for absolute imports', () => {
    expect(isExternalImport('/absolute/path')).toBe(false)
  })
})

describe('isRelativeImport', () => {
  it('returns true for relative imports', () => {
    expect(isRelativeImport('./foo')).toBe(true)
    expect(isRelativeImport('../bar')).toBe(true)
    expect(isRelativeImport('../../baz')).toBe(true)
  })

  it('returns true for absolute imports', () => {
    expect(isRelativeImport('/absolute/path')).toBe(true)
  })

  it('returns false for package imports', () => {
    expect(isRelativeImport('react')).toBe(false)
    expect(isRelativeImport('@org/package')).toBe(false)
  })
})
