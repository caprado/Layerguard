/**
 * Architecture Panel
 *
 * Shows contextual architecture info for the current file
 */

import * as vscode from 'vscode'
import type { LayerguardService } from '../services/layerguardService.js'

export class ArchitecturePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'layerguardArchitecture'

  private _view?: vscode.WebviewView
  private service: LayerguardService
  private currentFile?: string

  constructor(service: LayerguardService, _extensionUri: vscode.Uri) {
    this.service = service
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
    }

    // Track active editor
    const editorListener = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        this.currentFile = editor.document.uri.fsPath
        this.updateView()
      }
    })
    // Ensure listener is disposed when view is disposed
    webviewView.onDidDispose(() => editorListener.dispose())

    // Set initial file
    if (vscode.window.activeTextEditor) {
      this.currentFile = vscode.window.activeTextEditor.document.uri.fsPath
    }

    webviewView.webview.html = this.getHtml()

  }

  update(): void {
    this.updateView()
  }

  async refresh(): Promise<void> {
    await this.service.loadConfiguration()
    this.updateView()
  }

  private updateView(): void {
    if (this._view) {
      this._view.webview.html = this.getHtml()
    }
  }

  private getHtml(): string {
    const config = this.service.getConfig()

    if (!config) {
      return this.noConfigHtml()
    }

    const layers = Object.keys(config.layers)
    const currentLayer = this.currentFile
      ? this.service.getLayerForFile(this.currentFile)
      : undefined

    const flows = this.service.getParsedFlows()

    const canImport = currentLayer
      ? flows.filter(f => f.from === currentLayer).map(f => f.to)
      : []

    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: 12px;
      color: var(--vscode-foreground);
      padding: 8px;
      line-height: 1.4;
    }
    .section { margin-bottom: 12px; }
    .label {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .highlight { color: var(--vscode-textLink-foreground); }
    .muted { color: var(--vscode-descriptionForeground); }
    .layer-tag {
      display: inline-block;
      padding: 2px 6px;
      margin: 2px;
      border-radius: 3px;
      font-size: 11px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .layer-tag.current {
      background: var(--vscode-textLink-foreground);
      color: var(--vscode-editor-background);
    }
  </style>
</head>
<body>
  <div class="section">
    <div class="label">Layers</div>
    <div>${layers.map(l => `<span class="layer-tag${l === currentLayer ? ' current' : ''}">${l}</span>`).join('')}</div>
  </div>

  ${currentLayer ? `
  <div class="section">
    <div class="label">Current</div>
    <div><span class="highlight">${currentLayer}</span></div>
    ${canImport.length > 0 ? `<div class="muted">can import: ${canImport.join(', ')}</div>` : ''}
  </div>
  ` : ''}
</body>
</html>`
  }

  private noConfigHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 12px;
    }
    .none { color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <p class="none">No layerguard.config.ts found</p>
</body>
</html>`
  }
}

export function registerArchitecturePanel(
  context: vscode.ExtensionContext,
  service: LayerguardService
): ArchitecturePanelProvider {
  const provider = new ArchitecturePanelProvider(service, context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ArchitecturePanelProvider.viewType,
      provider
    )
  )

  return provider
}
