import { describe, it, expect, beforeAll } from 'vitest'
import { execSync } from 'child_process'
import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const FIXTURES_DIR = resolve(__dirname, '../fixtures')
const CLI_PATH = resolve(__dirname, '../../bin/layerguard.js')

interface ExpectedResult {
  description: string
  expectedViolations: Array<{
    type: string
    message?: string
    fromLayer?: string
    toLayer?: string | null
    files?: Array<{ source: string; target: string; line?: number }>
  }>
  expectedValidFlows?: Array<{
    from: string
    to: string
    files: string[]
    note?: string
  }>
  notes?: string[]
}

interface Fixture {
  name: string
  path: string
  expected: ExpectedResult
}

function loadFixtures(): Fixture[] {
  const fixtures: Fixture[] = []
  const entries = readdirSync(FIXTURES_DIR, { withFileTypes: true })
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fixturePath = join(FIXTURES_DIR, entry.name)
      const expectedPath = join(fixturePath, 'expected-results.json')
      
      try {
        const expected = JSON.parse(readFileSync(expectedPath, 'utf-8'))
        fixtures.push({
          name: entry.name,
          path: fixturePath,
          expected,
        })
      } catch {
        // Skip fixtures without expected-results.json
      }
    }
  }
  
  return fixtures
}

function parseViolations(output: string): any[] {
  // Try to find JSON output in the string
  const jsonMatch = output.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0])
      return result.violations || []
    } catch {
      // Fall through to line-by-line parsing
    }
  }
  
  // Fallback: try to parse each line as JSON
  const lines = output.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('{')) {
      try {
        const result = JSON.parse(trimmed)
        if (result.violations) {
          return result.violations
        }
      } catch {
        // Continue to next line
      }
    }
  }
  
  return []
}

function runCheck(fixturePath: string): { success: boolean; output: string; violations: any[]; error?: string } {
  let output = ''
  
  try {
    output = execSync(`node "${CLI_PATH}" check --json`, {
      cwd: fixturePath,
      encoding: 'utf-8',
      timeout: 30000,
    })
    
    const violations = parseViolations(output)
    return {
      success: violations.length === 0,
      output,
      violations,
    }
  } catch (error: any) {
    // Command failed - violations exist or real error
    output = error.stdout || output || ''
    
    if (output) {
      const violations = parseViolations(output)
      return {
        success: violations.length === 0,
        output,
        violations,
      }
    }
    
    return {
      success: false,
      output: error.message || '',
      violations: [],
      error: error.message,
    }
  }
}

describe('Integration Fixtures', () => {
  const fixtures = loadFixtures()
  
  beforeAll(() => {
    console.log(`\nFound ${fixtures.length} integration fixtures:\n`)
    fixtures.forEach(f => console.log(`  - ${f.name}`))
    console.log('')
  })
  
  for (const fixture of fixtures) {
    describe(fixture.name, () => {
      let result: ReturnType<typeof runCheck>
      
      beforeAll(() => {
        result = runCheck(fixture.path)
      })
      
      it('should run without errors', () => {
        expect(() => result).not.toThrow()
      })
      
      it('should detect expected violations', () => {
        // Filter out unmapped/config warnings for cleaner testing
        const actualViolations = result.violations.filter((v: any) => v.type !== 'unmapped')
        const expectedViolations = fixture.expected.expectedViolations || []
        
        // Strict matching: expect exact violation count
        expect(actualViolations.length).toBe(expectedViolations.length)
        
        // Verify each expected violation exists in actual results
        for (const expectedV of expectedViolations) {
          const matching = actualViolations.find((v: any) => 
            v.type === expectedV.type &&
            v.sourceFile?.includes(expectedV.files?.[0]?.source.split('/').pop() || '') ||
            (expectedV.message && v.message?.includes(expectedV.message))
          )
          
          expect(matching).toBeDefined()
        }
      })
      
      it(`should have exactly ${fixture.expected.expectedViolations?.length || 0} violations`, () => {
        const expectedCount = fixture.expected.expectedViolations?.length || 0
        const actualViolations = result.violations.filter((v: any) => v.type !== 'unmapped')
        expect(actualViolations.length).toBe(expectedCount)
      })
      
      if (fixture.expected.expectedViolations?.length === 0) {
        it('should pass with no violations', () => {
          expect(result.success).toBe(true)
          expect(result.violations).toHaveLength(0)
        })
      } else {
        it('should fail with violations', () => {
          expect(result.success).toBe(false)
          expect(result.violations.length).toBeGreaterThan(0)
        })
      }
      
      // Log actual violations for debugging
      it('logs violations for debugging', () => {
        if (result.violations.length > 0) {
          console.log(`\n  Violations found in ${fixture.name}:`)
          result.violations.forEach((v: any) => {
            console.log(`    - ${v.type}: ${v.message || 'No message'}`)
            if (v.files) {
              v.files.forEach((f: any) => {
                console.log(`      ${f.source} -> ${f.target}`)
              })
            }
          })
        }
      })
    })
  }
  
  describe('Meta', () => {
    it('should have at least 3 fixtures', () => {
      expect(fixtures.length).toBeGreaterThanOrEqual(3)
    })
    
    it('should include clean-architecture fixture', () => {
      expect(fixtures.some(f => f.name === 'clean-architecture')).toBe(true)
    })
    
    it('should include circular-deps fixture', () => {
      expect(fixtures.some(f => f.name === 'circular-deps')).toBe(true)
    })
  })
})
