/**
 * Import extractor - uses TypeScript Compiler API to extract imports from source files
 */

import ts from 'typescript'
import { readFileSync } from 'node:fs'

/**
 * Types of imports we can detect
 */
export type ImportKind =
  | 'static' // import ... from '...'
  | 'dynamic' // import('...')
  | 'require' // require('...')
  | 'reexport' // export ... from '...'

/**
 * Information about a single import
 */
export interface ImportInfo {
  /**
   * The import specifier (the string in quotes)
   */
  specifier: string

  /**
   * Type of import
   */
  kind: ImportKind

  /**
   * Whether this is a type-only import
   */
  isTypeOnly: boolean

  /**
   * Line number in the source file (1-indexed)
   */
  line: number

  /**
   * Column number in the source file (0-indexed)
   */
  column: number
}

/**
 * Result of extracting imports from a file
 */
export interface ExtractionResult {
  /**
   * Path to the source file
   */
  filePath: string

  /**
   * All imports found in the file
   */
  imports: ImportInfo[]

  /**
   * Any errors encountered during parsing
   */
  errors: string[]
}

/**
 * Options for import extraction
 */
export interface ExtractOptions {
  /**
   * Whether to include type-only imports
   * @default true
   */
  includeTypeOnly?: boolean

  /**
   * Whether to include dynamic imports
   * @default true
   */
  includeDynamic?: boolean

  /**
   * Whether to include require() calls
   * @default true
   */
  includeRequire?: boolean

  /**
   * Whether to include re-exports (export ... from)
   * @default true
   */
  includeReexports?: boolean
}

const defaultOptions: Required<ExtractOptions> = {
  includeTypeOnly: true,
  includeDynamic: true,
  includeRequire: true,
  includeReexports: true,
}

/**
 * Extract all imports from a TypeScript/JavaScript source file
 */
export function extractImports(
  filePath: string,
  options: ExtractOptions = {}
): ExtractionResult {
  const opts = { ...defaultOptions, ...options }
  const imports: ImportInfo[] = []
  const errors: string[] = []

  let sourceText: string
  try {
    sourceText = readFileSync(filePath, 'utf-8')
  } catch (err) {
    return {
      filePath,
      imports: [],
      errors: [`Failed to read file: ${err instanceof Error ? err.message : String(err)}`],
    }
  }

  // Determine script kind based on file extension
  const scriptKind = getScriptKind(filePath)

  // Parse the source file
  let sourceFile: ts.SourceFile
  try {
    sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true, // setParentNodes
      scriptKind
    )
  } catch (err) {
    return {
      filePath,
      imports: [],
      errors: [`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`],
    }
  }

  // Walk the AST
  function visit(node: ts.Node): void {
    // Static imports: import ... from '...'
    if (ts.isImportDeclaration(node)) {
      const specifier = getModuleSpecifier(node.moduleSpecifier)
      if (specifier) {
        const isTypeOnly = node.importClause?.isTypeOnly ?? false

        if (isTypeOnly && !opts.includeTypeOnly) {
          return
        }

        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
        imports.push({
          specifier,
          kind: 'static',
          isTypeOnly,
          line: line + 1,
          column: character,
        })
      }
    }

    // Re-exports: export ... from '...'
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && opts.includeReexports) {
      const specifier = getModuleSpecifier(node.moduleSpecifier)
      if (specifier) {
        const isTypeOnly = node.isTypeOnly
        if (isTypeOnly && !opts.includeTypeOnly) {
          return
        }

        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
        imports.push({
          specifier,
          kind: 'reexport',
          isTypeOnly,
          line: line + 1,
          column: character,
        })
      }
    }

    // Dynamic imports: import('...')
    if (opts.includeDynamic && ts.isCallExpression(node)) {
      // Check for import() calls
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length > 0
      ) {
        const arg = node.arguments[0]
        if (arg && ts.isStringLiteral(arg)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
          imports.push({
            specifier: arg.text,
            kind: 'dynamic',
            isTypeOnly: false,
            line: line + 1,
            column: character,
          })
        }
      }
    }

    // require() calls
    if (opts.includeRequire && ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length > 0
      ) {
        const arg = node.arguments[0]
        if (arg && ts.isStringLiteral(arg)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
          imports.push({
            specifier: arg.text,
            kind: 'require',
            isTypeOnly: false,
            line: line + 1,
            column: character,
          })
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return { filePath, imports, errors }
}

/**
 * Extract the module specifier string from a node
 */
function getModuleSpecifier(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node)) {
    return node.text
  }
  return null
}

/**
 * Determine TypeScript script kind from file extension
 */
function getScriptKind(filePath: string): ts.ScriptKind {
  const ext = filePath.toLowerCase()
  if (ext.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (ext.endsWith('.ts') || ext.endsWith('.mts') || ext.endsWith('.cts')) return ts.ScriptKind.TS
  if (ext.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (ext.endsWith('.js') || ext.endsWith('.mjs') || ext.endsWith('.cjs')) return ts.ScriptKind.JS
  return ts.ScriptKind.Unknown
}

/**
 * Extract imports from multiple files
 */
export function extractImportsFromFiles(
  filePaths: string[],
  options: ExtractOptions = {}
): Map<string, ExtractionResult> {
  const results = new Map<string, ExtractionResult>()

  for (const filePath of filePaths) {
    results.set(filePath, extractImports(filePath, options))
  }

  return results
}

/**
 * Check if an import specifier is external (from node_modules)
 */
export function isExternalImport(specifier: string): boolean {
  // External imports don't start with . or /
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    return false
  }

  // Check for scoped packages (@org/package) or regular packages
  // Also exclude node: protocol imports
  if (specifier.startsWith('node:')) {
    return true
  }

  return true
}

/**
 * Check if an import is a relative import
 */
export function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/')
}
