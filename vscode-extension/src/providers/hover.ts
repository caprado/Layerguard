/**
 * Hover Provider
 *
 * Shows layer information when hovering over imports
 */

import * as vscode from 'vscode'
import * as path from 'path'
import type { ArchgateService } from '../services/archgateService.js'
import type { ParsedFlowRule } from 'archgate/config'

/**
 * Hover provider for import statements
 */
export class LayerHoverProvider implements vscode.HoverProvider {
  private service: ArchgateService

  constructor(service: ArchgateService) {
    this.service = service
  }

  /**
   * Provide hover information
   */
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | undefined {
    if (!this.service.hasConfig()) {
      return undefined
    }

    const line = document.lineAt(position.line)
    const lineText = line.text

    // Check if this is an import line
    const importMatch = this.findImportAtPosition(lineText, position.character)
    if (!importMatch) {
      return undefined
    }

    const { importPath, range } = importMatch

    // Resolve the import path to a file
    const resolvedPath = this.resolveImport(document.uri.fsPath, importPath)
    if (!resolvedPath) {
      return undefined
    }

    // Get layer information
    const sourceFile = document.uri.fsPath
    const targetFile = resolvedPath

    const sourceLayer = this.service.getLayerForFile(sourceFile)
    const targetLayer = this.service.getLayerForFile(targetFile)

    // Build hover content
    const markdown = new vscode.MarkdownString()
    markdown.isTrusted = true

    markdown.appendMarkdown('### Archgate Layer Info\n\n')

    // Source layer
    if (sourceLayer) {
      markdown.appendMarkdown(`**Source:** \`${sourceLayer}\`\n\n`)
    } else {
      markdown.appendMarkdown(`**Source:** _(unmapped)_\n\n`)
    }

    // Target layer
    if (targetLayer) {
      markdown.appendMarkdown(`**Target:** \`${targetLayer}\`\n\n`)
    } else {
      markdown.appendMarkdown(`**Target:** _(unmapped)_\n\n`)
    }

    // Check if this import is allowed
    const importCheck = this.service.checkImport(sourceFile, targetFile)

    if (importCheck.allowed) {
      markdown.appendMarkdown('✅ **Import allowed**\n')
    } else {
      markdown.appendMarkdown(`❌ **Import not allowed**\n\n${importCheck.reason}\n`)
    }

    // Add flow context if both layers are mapped
    if (sourceLayer && targetLayer && sourceLayer !== targetLayer) {
      const flows = this.service.getParsedFlows()

      const relevantFlows = flows.filter((f: ParsedFlowRule) =>
        (f.from === sourceLayer && f.to === targetLayer) ||
        (f.from === targetLayer && f.to === sourceLayer)
      )

      if (relevantFlows.length > 0) {
        markdown.appendMarkdown('\n---\n\n**Relevant flow rules:**\n\n')
        for (const flow of relevantFlows) {
          const arrow = flow.direction === 'bidirectional' ? '↔' : '→'
          markdown.appendMarkdown(`- \`${flow.from}\` ${arrow} \`${flow.to}\`\n`)
        }
      }
    }

    // Create the hover with range
    const hoverRange = new vscode.Range(
      position.line,
      range.start,
      position.line,
      range.end
    )

    return new vscode.Hover(markdown, hoverRange)
  }

  /**
   * Find an import specifier at the given position
   */
  private findImportAtPosition(
    lineText: string,
    character: number
  ): { importPath: string; range: { start: number; end: number } } | undefined {
    // Match various import patterns
    const patterns = [
      // import ... from 'path'
      /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
      // import 'path'
      /import\s+['"]([^'"]+)['"]/g,
      // require('path')
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // dynamic import('path')
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ]

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(lineText)) !== null) {
        const importPath = match[1]
        if (!importPath) continue

        // Find where the path string starts and ends
        const fullMatch = match[0]
        const pathStart = match.index + fullMatch.indexOf(importPath)
        const pathEnd = pathStart + importPath.length

        // Check if cursor is within the import path
        if (character >= pathStart && character <= pathEnd) {
          return {
            importPath,
            range: { start: pathStart, end: pathEnd }
          }
        }
      }
    }

    return undefined
  }

  /**
   * Resolve an import path to an absolute file path
   */
  private resolveImport(sourceFile: string, importPath: string): string | undefined {
    // Skip external packages (non-relative imports)
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return undefined
    }

    // Resolve relative path
    const sourceDir = path.dirname(sourceFile)
    let resolved = path.resolve(sourceDir, importPath)

    // Add extension if needed
    if (!resolved.match(/\.(ts|tsx|js|jsx|mjs|cjs)$/)) {
      return resolved + '.ts'
    }

    return resolved
  }
}

/**
 * Register the hover provider
 */
export function registerHoverProvider(
  context: vscode.ExtensionContext,
  service: ArchgateService
): LayerHoverProvider {
  const provider = new LayerHoverProvider(service)

  const selector: vscode.DocumentSelector = [
    { language: 'typescript', scheme: 'file' },
    { language: 'typescriptreact', scheme: 'file' },
    { language: 'javascript', scheme: 'file' },
    { language: 'javascriptreact', scheme: 'file' },
  ]

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, provider)
  )

  return provider
}
