/**
 * HTML Report Generator
 *
 * Generates an HTML report of architectural violations with visual charts
 * and detailed breakdowns.
 */

import type { ViolationReport, Violation } from '../enforcer/violations.js'
import type { ArchgateConfig } from '../config/types.js'

/**
 * Historical data point for trend analysis
 */
export interface HistoricalDataPoint {
  /**
   * Timestamp of the check
   */
  timestamp: string

  /**
   * ISO date string
   */
  date: string

  /**
   * Commit SHA if available
   */
  commitSha?: string

  /**
   * Branch name if available
   */
  branch?: string

  /**
   * Violation counts
   */
  counts: ViolationReport['counts']

  /**
   * Total file count
   */
  fileCount: number

  /**
   * Total import count
   */
  importCount: number
}

/**
 * Options for HTML report generation
 */
export interface HtmlReportOptions {
  /**
   * Report title
   */
  title?: string

  /**
   * Project name
   */
  projectName?: string

  /**
   * Historical data for trend analysis
   */
  history?: HistoricalDataPoint[]

  /**
   * Archgate configuration (for layer info)
   */
  config?: ArchgateConfig

  /**
   * File and import counts
   */
  stats?: {
    fileCount: number
    importCount: number
  }
}

/**
 * Generate an HTML report
 */
export function generateHtmlReport(report: ViolationReport, options: HtmlReportOptions = {}): string {
  const {
    title = 'Archgate Report',
    projectName = 'Project',
    history = [],
    stats,
  } = options

  const timestamp = new Date().toISOString()
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Group violations
  const violationsByLayer = groupViolationsByLayer(report.violations)
  const hotFiles = getHotFiles(report.violations)

  // Generate chart data
  const typeChartData = generateTypeChartData(report.counts)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --color-bg: #0d1117;
      --color-bg-secondary: #161b22;
      --color-border: #30363d;
      --color-text: #c9d1d9;
      --color-text-secondary: #8b949e;
      --color-success: #3fb950;
      --color-warning: #d29922;
      --color-error: #f85149;
      --color-info: #58a6ff;
      --color-accent: #7c3aed;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--color-border);
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--color-text-secondary);
      font-size: 1.1rem;
    }

    .status-badge {
      display: inline-block;
      padding: 0.5rem 1.5rem;
      border-radius: 2rem;
      font-weight: 600;
      font-size: 1.2rem;
      margin-top: 1.5rem;
    }

    .status-passed {
      background: rgba(63, 185, 80, 0.2);
      color: var(--color-success);
      border: 1px solid var(--color-success);
    }

    .status-failed {
      background: rgba(248, 81, 73, 0.2);
      color: var(--color-error);
      border: 1px solid var(--color-error);
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 3rem;
    }

    .summary-card {
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.5rem;
      text-align: center;
    }

    .summary-card .value {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }

    .summary-card .label {
      color: var(--color-text-secondary);
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .summary-card.error .value { color: var(--color-error); }
    .summary-card.warning .value { color: var(--color-warning); }
    .summary-card.info .value { color: var(--color-info); }

    section {
      margin-bottom: 3rem;
    }

    h2 {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--color-border);
    }

    .chart-container {
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .bar-item {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .bar-label {
      width: 120px;
      font-size: 0.9rem;
      text-align: right;
      color: var(--color-text-secondary);
    }

    .bar-track {
      flex: 1;
      height: 24px;
      background: var(--color-bg);
      border-radius: 4px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .bar-fill.flow { background: var(--color-error); }
    .bar-fill.isolation { background: var(--color-warning); }
    .bar-fill.circular { background: var(--color-accent); }
    .bar-fill.unlayered { background: var(--color-info); }
    .bar-fill.depth { background: #f97316; }
    .bar-fill.publicApi { background: #ec4899; }
    .bar-fill.dependentBudget { background: #06b6d4; }
    .bar-fill.importCount { background: #84cc16; }
    .bar-fill.unmapped { background: var(--color-text-secondary); }

    .bar-value {
      width: 50px;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .violations-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      overflow: hidden;
    }

    .violations-table th,
    .violations-table td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--color-border);
    }

    .violations-table th {
      background: var(--color-bg);
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-secondary);
    }

    .violations-table tr:last-child td {
      border-bottom: none;
    }

    .violations-table tr:hover td {
      background: rgba(88, 166, 255, 0.05);
    }

    .type-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .type-badge.flow { background: rgba(248, 81, 73, 0.2); color: var(--color-error); }
    .type-badge.isolation { background: rgba(210, 153, 34, 0.2); color: var(--color-warning); }
    .type-badge.circular { background: rgba(124, 58, 237, 0.2); color: var(--color-accent); }
    .type-badge.unlayered { background: rgba(88, 166, 255, 0.2); color: var(--color-info); }

    .file-path {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.85rem;
      color: var(--color-info);
    }

    .hot-files-list {
      display: grid;
      gap: 0.75rem;
    }

    .hot-file-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border);
      border-radius: 0.5rem;
    }

    .hot-file-count {
      background: var(--color-error);
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.85rem;
    }

    .no-data {
      text-align: center;
      padding: 3rem;
      color: var(--color-text-secondary);
    }

    footer {
      text-align: center;
      padding: 2rem 0;
      border-top: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      font-size: 0.9rem;
    }

    footer a {
      color: var(--color-info);
      text-decoration: none;
    }

    footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(projectName)} · ${dateStr}</p>
      <span class="status-badge ${report.passed ? 'status-passed' : 'status-failed'}">
        ${report.passed ? '✓ Passed' : '✗ Failed'}
      </span>
    </header>

    <div class="summary-grid">
      <div class="summary-card error">
        <div class="value">${report.severityCounts.error}</div>
        <div class="label">Errors</div>
      </div>
      <div class="summary-card warning">
        <div class="value">${report.severityCounts.warn}</div>
        <div class="label">Warnings</div>
      </div>
      <div class="summary-card info">
        <div class="value">${report.counts.total}</div>
        <div class="label">Total Violations</div>
      </div>
      ${stats ? `
      <div class="summary-card">
        <div class="value">${stats.fileCount}</div>
        <div class="label">Files Analyzed</div>
      </div>
      ` : ''}
    </div>

    <section>
      <h2>Violations by Type</h2>
      <div class="chart-container">
        ${typeChartData.length > 0 ? `
        <div class="bar-chart">
          ${typeChartData.map(item => `
          <div class="bar-item">
            <span class="bar-label">${item.label}</span>
            <div class="bar-track">
              <div class="bar-fill ${item.type}" style="width: ${item.percentage}%"></div>
            </div>
            <span class="bar-value">${item.count}</span>
          </div>
          `).join('')}
        </div>
        ` : '<div class="no-data">No violations found</div>'}
      </div>
    </section>

    ${violationsByLayer.length > 0 ? `
    <section>
      <h2>Violations by Layer</h2>
      <div class="chart-container">
        <div class="bar-chart">
          ${violationsByLayer.slice(0, 10).map(item => `
          <div class="bar-item">
            <span class="bar-label">${escapeHtml(item.layer)}</span>
            <div class="bar-track">
              <div class="bar-fill flow" style="width: ${item.percentage}%"></div>
            </div>
            <span class="bar-value">${item.count}</span>
          </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : ''}

    ${hotFiles.length > 0 ? `
    <section>
      <h2>Hot Files</h2>
      <p class="subtitle" style="margin-bottom: 1rem; color: var(--color-text-secondary);">
        Files involved in the most violations
      </p>
      <div class="hot-files-list">
        ${hotFiles.slice(0, 10).map(item => `
        <div class="hot-file-item">
          <div class="hot-file-count">${item.count}</div>
          <span class="file-path">${escapeHtml(item.file)}</span>
        </div>
        `).join('')}
      </div>
    </section>
    ` : ''}

    ${report.violations.length > 0 ? `
    <section>
      <h2>All Violations</h2>
      <table class="violations-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Source</th>
            <th>Target</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          ${report.violations.slice(0, 100).map(v => `
          <tr>
            <td><span class="type-badge ${v.type}">${v.type}</span></td>
            <td class="file-path">${escapeHtml(v.sourceFile)}${v.line ? `:${v.line}` : ''}</td>
            <td class="file-path">${escapeHtml(v.targetFile ?? '-')}</td>
            <td>${escapeHtml(v.message)}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      ${report.violations.length > 100 ? `
      <p style="text-align: center; margin-top: 1rem; color: var(--color-text-secondary);">
        Showing first 100 of ${report.violations.length} violations
      </p>
      ` : ''}
    </section>
    ` : ''}

    ${history.length > 1 ? `
    <section>
      <h2>Trend</h2>
      <div class="chart-container">
        <p style="color: var(--color-text-secondary); margin-bottom: 1rem;">
          Violation count over time (${history.length} data points)
        </p>
        <!-- Trend data visualization would go here -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${history.slice(-20).map(point => {
            const height = Math.max(4, Math.min(100, point.counts.total * 2))
            return `<div style="width: 20px; height: ${height}px; background: ${point.counts.total > 0 ? 'var(--color-error)' : 'var(--color-success)'}; border-radius: 2px;" title="${point.date}: ${point.counts.total} violations"></div>`
          }).join('')}
        </div>
      </div>
    </section>
    ` : ''}

    <footer>
      <p>Generated by <a href="https://github.com/caprado/archgate">Archgate</a> at ${timestamp}</p>
    </footer>
  </div>
</body>
</html>`
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Group violations by type
 */
export function groupViolationsByType(violations: Violation[]): Map<string, Violation[]> {
  const groups = new Map<string, Violation[]>()
  for (const v of violations) {
    const list = groups.get(v.type) ?? []
    list.push(v)
    groups.set(v.type, list)
  }
  return groups
}

/**
 * Group violations by layer
 */
function groupViolationsByLayer(violations: Violation[]): Array<{ layer: string; count: number; percentage: number }> {
  const counts = new Map<string, number>()
  for (const v of violations) {
    if (v.sourceLayer) {
      counts.set(v.sourceLayer, (counts.get(v.sourceLayer) ?? 0) + 1)
    }
  }

  const total = violations.length || 1
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([layer, count]) => ({
      layer,
      count,
      percentage: (count / total) * 100,
    }))

  return sorted
}

/**
 * Get files with the most violations
 */
function getHotFiles(violations: Violation[]): Array<{ file: string; count: number }> {
  const counts = new Map<string, number>()
  for (const v of violations) {
    counts.set(v.sourceFile, (counts.get(v.sourceFile) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([file, count]) => ({ file, count }))
}

/**
 * Generate chart data for violation types
 */
function generateTypeChartData(counts: ViolationReport['counts']): Array<{
  type: string
  label: string
  count: number
  percentage: number
}> {
  const total = counts.total || 1
  const items: Array<{ type: string; label: string; count: number; percentage: number }> = []

  const typeLabels: Record<string, string> = {
    flow: 'Flow',
    isolation: 'Isolation',
    circular: 'Circular',
    unlayered: 'Unlayered',
    depth: 'Depth',
    publicApi: 'Public API',
    dependentBudget: 'Dependents',
    importCount: 'Import Count',
    unmapped: 'Unmapped',
  }

  for (const [type, label] of Object.entries(typeLabels)) {
    const count = counts[type as keyof typeof counts] as number
    if (count > 0) {
      items.push({
        type,
        label,
        count,
        percentage: (count / total) * 100,
      })
    }
  }

  return items.sort((a, b) => b.count - a.count)
}

/**
 * Generate trend chart data
 */
export function generateTrendChartData(history: HistoricalDataPoint[]): Array<{
  date: string
  total: number
}> {
  return history.map(point => ({
    date: point.date,
    total: point.counts.total,
  }))
}

/**
 * Generate a simple markdown summary for PR comments
 */
export function generateMarkdownSummary(report: ViolationReport, options: { showDetails?: boolean } = {}): string {
  const { showDetails = true } = options

  const status = report.passed ? '✅ **Passed**' : '❌ **Failed**'

  let md = `## Archgate Check ${status}\n\n`

  md += `| Metric | Count |\n`
  md += `|--------|-------|\n`
  md += `| Errors | ${report.severityCounts.error} |\n`
  md += `| Warnings | ${report.severityCounts.warn} |\n`
  md += `| Total | ${report.counts.total} |\n\n`

  if (report.counts.total > 0) {
    md += `### Violations by Type\n\n`
    const types = ['flow', 'isolation', 'circular', 'unlayered', 'depth', 'publicApi', 'dependentBudget', 'importCount', 'unmapped'] as const
    for (const type of types) {
      const count = report.counts[type]
      if (count > 0) {
        md += `- **${type}**: ${count}\n`
      }
    }
    md += '\n'
  }

  if (showDetails && report.violations.length > 0) {
    md += `### Top Violations\n\n`
    const topViolations = report.violations.slice(0, 5)
    for (const v of topViolations) {
      md += `- \`${v.sourceFile}\`: ${v.message}\n`
    }
    if (report.violations.length > 5) {
      md += `\n*...and ${report.violations.length - 5} more*\n`
    }
  }

  md += `\n---\n*Generated by [Archgate](https://github.com/caprado/archgate)*`

  return md
}
