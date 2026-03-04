/**
 * Archgate VS Code Extension
 *
 * Entry point for the extension
 */

import * as vscode from 'vscode'
import { getArchgateService, clearArchgateService } from './services/archgateService.js'
import { DiagnosticsProvider } from './providers/diagnostics.js'
import { registerHoverProvider } from './providers/hover.js'
import { registerCodeActionsProvider } from './providers/codeActions.js'
import { registerArchitecturePanel, type ArchitecturePanelProvider } from './views/architecturePanel.js'

let diagnosticsProvider: DiagnosticsProvider | undefined
let architecturePanel: ArchitecturePanelProvider | undefined

/**
 * Activate the extension
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Archgate extension activating...')

  // Get workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!workspaceRoot) {
    console.log('No workspace folder found')
    return
  }

  // Initialize service (don't await config load yet)
  const service = getArchgateService(workspaceRoot)

  // Register providers IMMEDIATELY (before async config load)
  diagnosticsProvider = new DiagnosticsProvider(service)
  diagnosticsProvider.activate(context)
  registerHoverProvider(context, service)
  registerCodeActionsProvider(context, service)
  architecturePanel = registerArchitecturePanel(context, service)

  // NOW load config async
  const hasConfig = await service.loadConfiguration()

  // Set context for when clauses
  vscode.commands.executeCommand('setContext', 'archgate.hasConfig', hasConfig)

  if (hasConfig) {
    architecturePanel.update()
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('archgate.showArchitecture', async () => {
      // Focus the architecture panel
      await vscode.commands.executeCommand('archgateArchitecture.focus')
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('archgate.checkProject', async () => {
      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Archgate: Checking project...',
        cancellable: false,
      }, async () => {
        return await service.check()
      })

      if (result) {
        // Refresh diagnostics
        await diagnosticsProvider?.refreshAll()

        // Show result
        if (result.passed) {
          vscode.window.showInformationMessage(
            `Archgate: All checks passed! (${result.violations.length} warnings)`
          )
        } else {
          const errorCount = result.violations.filter(v => v.severity === 'error').length
          vscode.window.showErrorMessage(
            `Archgate: ${errorCount} errors found. Check the Problems panel for details.`
          )
        }
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('archgate.refreshDiagnostics', async () => {
      await diagnosticsProvider?.refreshAll()
      vscode.window.showInformationMessage('Archgate: Diagnostics refreshed')
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('archgate.suggestMove', async (
      _uri: vscode.Uri,
      suggestedPath: string,
      targetLayer: string
    ) => {
      const result = await vscode.window.showInformationMessage(
        `Move file to ${targetLayer} layer?\n\nSuggested path: ${suggestedPath}`,
        'Move File',
        'Cancel'
      )

      if (result === 'Move File') {
        // This is a simplified move - in reality you'd want to:
        // 1. Create the directory if needed
        // 2. Update imports in other files
        // 3. Handle git tracking
        vscode.window.showInformationMessage(
          `Manual action required: Move the file to ${suggestedPath} and update imports.`
        )
      }
    })
  )

  // Watch for config file changes
  const configWatcher = vscode.workspace.createFileSystemWatcher(
    '**/archgate.config.{ts,js,mjs}'
  )

  configWatcher.onDidChange(async () => {
    await service.loadConfiguration()
    await diagnosticsProvider?.refreshAll()
    await architecturePanel?.refresh()
    vscode.commands.executeCommand('setContext', 'archgate.hasConfig', service.hasConfig())
  })

  configWatcher.onDidCreate(async () => {
    await service.loadConfiguration()
    await diagnosticsProvider?.refreshAll()
    await architecturePanel?.refresh()
    vscode.commands.executeCommand('setContext', 'archgate.hasConfig', service.hasConfig())
  })

  configWatcher.onDidDelete(async () => {
    clearArchgateService()
    diagnosticsProvider?.refreshAll()
    await architecturePanel?.refresh()
    vscode.commands.executeCommand('setContext', 'archgate.hasConfig', false)
  })

  context.subscriptions.push(configWatcher)

  // Initial diagnostics refresh
  if (hasConfig) {
    await diagnosticsProvider.refreshAll()
  }

  console.log('Archgate extension activated')
}

/**
 * Deactivate the extension
 */
export function deactivate(): void {
  diagnosticsProvider?.dispose()
  clearArchgateService()
  console.log('Archgate extension deactivated')
}
