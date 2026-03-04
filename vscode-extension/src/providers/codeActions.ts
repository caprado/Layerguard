/**
 * Code Actions Provider
 *
 * Provides quick fixes for architectural violations
 */

import * as vscode from 'vscode'
import * as path from 'path'
import type { LayerguardService } from '../services/layerguardService.js'

/**
 * Code actions provider for layerguard violations
 */
export class LayerguardCodeActionsProvider implements vscode.CodeActionProvider {
  private service: LayerguardService

  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ]

  constructor(service: LayerguardService) {
    this.service = service
  }

  /**
   * Provide code actions for diagnostics
   */
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []

    // Filter to layerguard diagnostics
    const layerguardDiagnostics = context.diagnostics.filter(
      d => d.source === 'layerguard'
    )

    for (const diagnostic of layerguardDiagnostics) {
      const lineText = document.lineAt(diagnostic.range.start.line).text

      // Add suppress comment action
      actions.push(this.createSuppressAction(document, diagnostic))

      // Add type-only import action for flow violations
      if (diagnostic.code === 'flow' || diagnostic.code === 'isolation') {
        const typeOnlyAction = this.createTypeOnlyImportAction(document, diagnostic, lineText)
        if (typeOnlyAction) {
          actions.push(typeOnlyAction)
        }
      }

      // Add move suggestion for certain violations
      const moveAction = this.createMoveFileSuggestion(document, diagnostic)
      if (moveAction) {
        actions.push(moveAction)
      }
    }

    return actions
  }

  /**
   * Create a suppress comment action
   */
  private createSuppressAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Suppress this violation',
      vscode.CodeActionKind.QuickFix
    )

    const edit = new vscode.WorkspaceEdit()
    const line = diagnostic.range.start.line
    const lineText = document.lineAt(line).text
    const indent = lineText.match(/^\s*/)?.[0] ?? ''

    // Insert suppress comment above the line
    edit.insert(
      document.uri,
      new vscode.Position(line, 0),
      `${indent}// layerguard-ignore-next-line ${diagnostic.code}\n`
    )

    action.edit = edit
    action.diagnostics = [diagnostic]
    action.isPreferred = false

    return action
  }

  /**
   * Create action to convert to type-only import
   */
  private createTypeOnlyImportAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    lineText: string
  ): vscode.CodeAction | undefined {
    // Check if this is already a type import
    if (lineText.includes('import type')) {
      return undefined
    }

    // Check if it's a regular import that can be converted
    const importMatch = lineText.match(/^(\s*)import\s+(\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from/)
    if (!importMatch) {
      return undefined
    }

    const action = new vscode.CodeAction(
      'Convert to type-only import',
      vscode.CodeActionKind.QuickFix
    )

    const edit = new vscode.WorkspaceEdit()
    const line = diagnostic.range.start.line

    // Replace 'import' with 'import type'
    const importIndex = lineText.indexOf('import')
    edit.replace(
      document.uri,
      new vscode.Range(
        new vscode.Position(line, importIndex),
        new vscode.Position(line, importIndex + 'import'.length)
      ),
      'import type'
    )

    action.edit = edit
    action.diagnostics = [diagnostic]
    action.isPreferred = false

    return action
  }

  /**
   * Create a suggestion to move file to correct layer
   */
  private createMoveFileSuggestion(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction | undefined {
    // Only suggest for flow violations
    if (diagnostic.code !== 'flow') {
      return undefined
    }

    // Extract source and target layers from message
    const layerMatch = diagnostic.message.match(/from "(\w+)" to "(\w+)"/)
    if (!layerMatch) {
      return undefined
    }

    const [, _sourceLayer, targetLayer] = layerMatch
    const config = this.service.getConfig()
    if (!config || !targetLayer) {
      return undefined
    }

    const targetLayerConfig = config.layers[targetLayer]
    if (!targetLayerConfig) {
      return undefined
    }

    // Get suggested path
    const fileName = path.basename(document.uri.fsPath)
    const suggestedPath = path.join(targetLayerConfig.path, fileName)

    const action = new vscode.CodeAction(
      `Move file to ${targetLayer} layer (${suggestedPath})`,
      vscode.CodeActionKind.QuickFix
    )

    // This is just a suggestion - actual move would need more work
    action.command = {
      command: 'layerguard.suggestMove',
      title: 'Suggest Move',
      arguments: [document.uri, suggestedPath, targetLayer]
    }

    action.diagnostics = [diagnostic]
    action.isPreferred = false

    return action
  }
}

/**
 * Register the code actions provider
 */
export function registerCodeActionsProvider(
  context: vscode.ExtensionContext,
  service: LayerguardService
): LayerguardCodeActionsProvider {
  const provider = new LayerguardCodeActionsProvider(service)

  const selector: vscode.DocumentSelector = [
    { language: 'typescript', scheme: 'file' },
    { language: 'typescriptreact', scheme: 'file' },
    { language: 'javascript', scheme: 'file' },
    { language: 'javascriptreact', scheme: 'file' },
  ]

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      selector,
      provider,
      {
        providedCodeActionKinds: LayerguardCodeActionsProvider.providedCodeActionKinds
      }
    )
  )

  return provider
}
