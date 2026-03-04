/**
 * Diagnostics Provider
 *
 * Provides inline diagnostics (error squiggles) for architectural violations
 */

import * as vscode from 'vscode'
import * as path from 'path'
import type { ArchgateService } from '../services/archgateService.js'
import type { Violation } from 'archgate/enforcer'

/**
 * Diagnostics provider for archgate violations
 */
export class DiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection
  private service: ArchgateService
  private disposables: vscode.Disposable[] = []

  constructor(service: ArchgateService) {
    this.service = service
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('archgate')
  }

  /**
   * Activate the provider
   */
  activate(context: vscode.ExtensionContext): void {
    // Subscribe to document changes
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(doc => {
        const config = vscode.workspace.getConfiguration('archgate')
        if (config.get('validateOnSave', true)) {
          this.updateDiagnosticsForDocument(doc)
        }
      })
    )

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(event => {
        const config = vscode.workspace.getConfiguration('archgate')
        if (config.get('validateOnType', false)) {
          this.updateDiagnosticsForDocument(event.document)
        }
      })
    )

    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument(doc => {
        this.updateDiagnosticsForDocument(doc)
      })
    )

    this.disposables.push(
      vscode.workspace.onDidCloseTextDocument(doc => {
        this.diagnosticCollection.delete(doc.uri)
      })
    )

    // Add to context subscriptions
    context.subscriptions.push(this.diagnosticCollection)
    this.disposables.forEach(d => context.subscriptions.push(d))

    // Initial scan of open documents
    vscode.workspace.textDocuments.forEach(doc => {
      this.updateDiagnosticsForDocument(doc)
    })
  }

  /**
   * Update diagnostics for all open documents
   */
  async refreshAll(): Promise<void> {
    console.log('Archgate: refreshAll() called')
    // Clear all diagnostics
    this.diagnosticCollection.clear()

    // Run full check
    const result = await this.service.check()
    if (!result) {
      console.log('Archgate: refreshAll() - no check result')
      return
    }

    console.log('Archgate: refreshAll() - found', result.violations.length, 'violations')
    const workspaceRoot = this.service.getWorkspaceRoot()

    // Group violations by file
    const violationsByFile = new Map<string, Violation[]>()
    for (const violation of result.violations) {
      const existing = violationsByFile.get(violation.sourceFile) ?? []
      existing.push(violation)
      violationsByFile.set(violation.sourceFile, existing)
    }

    // Update diagnostics for each file
    for (const [relativePath, violations] of violationsByFile) {
      const absolutePath = path.join(workspaceRoot, relativePath)
      const uri = vscode.Uri.file(absolutePath)
      const diagnostics = violations.map(v => this.violationToDiagnostic(v))
      this.diagnosticCollection.set(uri, diagnostics)
    }
  }

  /**
   * Update diagnostics for a single document
   */
  async updateDiagnosticsForDocument(document: vscode.TextDocument): Promise<void> {
    // Only check TypeScript/JavaScript files
    if (!this.isRelevantDocument(document)) {
      return
    }

    const config = vscode.workspace.getConfiguration('archgate')
    if (!config.get('enable', true)) {
      this.diagnosticCollection.delete(document.uri)
      return
    }

    // Get violations for this file
    const filePath = document.uri.fsPath
    console.log('Archgate: Checking file:', filePath)
    const violations = await this.service.getViolationsForFile(filePath)
    console.log('Archgate: Found violations:', violations.length)

    // Convert to diagnostics
    const diagnostics = violations.map(v => this.violationToDiagnostic(v, document))
    this.diagnosticCollection.set(document.uri, diagnostics)
  }

  /**
   * Convert a violation to a VS Code diagnostic
   */
  private violationToDiagnostic(violation: Violation, document?: vscode.TextDocument): vscode.Diagnostic {
    let range: vscode.Range

    if (violation.line !== undefined && document) {
      // Use the actual line from the document
      const line = Math.max(0, violation.line - 1) // Convert to 0-indexed
      const textLine = document.lineAt(line)
      range = textLine.range
    } else if (violation.line !== undefined) {
      // Create range from line number without document
      const line = Math.max(0, violation.line - 1)
      range = new vscode.Range(line, 0, line, 100)
    } else {
      // Default to first line
      range = new vscode.Range(0, 0, 0, 100)
    }

    const severity = violation.severity === 'error'
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning

    const diagnostic = new vscode.Diagnostic(range, violation.message, severity)
    diagnostic.source = 'archgate'
    diagnostic.code = violation.type

    // Add related information for target file
    if (violation.targetFile) {
      diagnostic.relatedInformation = [
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(
            vscode.Uri.file(violation.targetFile),
            new vscode.Range(0, 0, 0, 0)
          ),
          `Target: ${violation.targetFile}`
        )
      ]
    }

    return diagnostic
  }

  /**
   * Check if a document is relevant for archgate
   */
  private isRelevantDocument(document: vscode.TextDocument): boolean {
    const languageIds = ['typescript', 'typescriptreact', 'javascript', 'javascriptreact']
    return languageIds.includes(document.languageId)
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.diagnosticCollection.dispose()
    this.disposables.forEach(d => d.dispose())
  }
}
