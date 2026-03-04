/**
 * Architecture diagram generator
 *
 * Creates text-based diagrams of the architecture
 */

import type { LayerguardConfig } from '../config/types.js'
import { parseFlowRules } from '../config/parser.js'

/**
 * Options for diagram generation
 */
export interface DiagramOptions {
  /**
   * Whether to use Unicode box-drawing characters
   * @default true
   */
  unicode?: boolean

  /**
   * Whether to show sublayers
   * @default true
   */
  showSublayers?: boolean

  /**
   * Whether to show flow rules
   * @default true
   */
  showFlow?: boolean
}

/**
 * Box drawing characters
 */
const boxChars = {
  unicode: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    down: '↓',
    leftRight: '↔',
    teeDown: '┬',
    teeUp: '┴',
  },
  ascii: {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
    down: 'v',
    leftRight: '<->',
    teeDown: '+',
    teeUp: '+',
  },
}

/**
 * Generate an architecture diagram from config
 */
export function generateDiagram(config: LayerguardConfig, options: DiagramOptions = {}): string {
  const { unicode = true, showSublayers = true, showFlow = true } = options
  const chars = unicode ? boxChars.unicode : boxChars.ascii
  const lines: string[] = []

  // Title
  lines.push('Layerguard Architecture')
  lines.push('')

  // Parse flow rules to understand relationships
  const parsedRules = parseFlowRules(config.flow)

  // Build a simple dependency order (topological-ish)
  const layerOrder = buildLayerOrder(config, parsedRules)

  // Generate boxes for each layer
  for (let i = 0; i < layerOrder.length; i++) {
    const layerName = layerOrder[i]!
    const layerConfig = config.layers[layerName]
    if (!layerConfig) continue

    const box = generateLayerBox(layerName, layerConfig, chars, showSublayers)
    lines.push(...box)

    // Add arrow to next layer if not last
    if (i < layerOrder.length - 1) {
      lines.push(`         ${chars.down}`)
    }
  }

  // Show flow rules summary
  if (showFlow && config.flow.length > 0) {
    lines.push('')
    lines.push('Flow rules:')
    for (const rule of config.flow) {
      lines.push(`  ${rule}`)
    }
  }

  return lines.join('\n')
}

/**
 * Build a simple layer order based on flow rules
 */
function buildLayerOrder(
  config: LayerguardConfig,
  parsedRules: Array<{ from: string; to: string; direction: string }>
): string[] {
  const layers = Object.keys(config.layers)

  // Count how many layers each layer depends on
  const dependencyCount = new Map<string, number>()
  for (const layer of layers) {
    dependencyCount.set(layer, 0)
  }

  for (const rule of parsedRules) {
    // 'from -> to' means 'from' depends on 'to', so 'to' should come after
    const count = dependencyCount.get(rule.from) ?? 0
    dependencyCount.set(rule.from, count + 1)
  }

  // Sort by dependency count (most dependencies first = higher in hierarchy)
  return layers.sort((a, b) => {
    const countA = dependencyCount.get(a) ?? 0
    const countB = dependencyCount.get(b) ?? 0
    return countB - countA
  })
}

/**
 * Generate a box for a single layer
 */
function generateLayerBox(
  name: string,
  config: { path: string; sublayers?: Record<string, { path: string; isolated?: boolean }>; flow?: string[] },
  chars: typeof boxChars.unicode,
  showSublayers: boolean
): string[] {
  const lines: string[] = []
  const boxWidth = 30

  // Calculate content
  const title = `${name} (${config.path})`
  const paddedTitle = padCenter(title, boxWidth - 2)

  // Top border
  lines.push(chars.topLeft + chars.horizontal.repeat(boxWidth - 2) + chars.topRight)

  // Title
  lines.push(chars.vertical + paddedTitle + chars.vertical)

  // Sublayers
  if (showSublayers && config.sublayers) {
    const sublayerNames = Object.keys(config.sublayers)
    for (const sublayerName of sublayerNames) {
      const sublayerConfig = config.sublayers[sublayerName]
      if (!sublayerConfig) continue

      const isolated = sublayerConfig.isolated ? ' [isolated]' : ''
      const sublayerLine = `  ├── ${sublayerName}/${isolated}`
      const paddedLine = padRight(sublayerLine, boxWidth - 2)
      lines.push(chars.vertical + paddedLine + chars.vertical)
    }

    // Sublayer flow if present
    if (config.flow && config.flow.length > 0) {
      const flowLine = `  ${config.flow.join(' ')}`
      const paddedFlow = padRight(flowLine, boxWidth - 2)
      lines.push(chars.vertical + paddedFlow + chars.vertical)
    }
  }

  // Bottom border
  lines.push(chars.bottomLeft + chars.horizontal.repeat(boxWidth - 2) + chars.bottomRight)

  return lines
}

/**
 * Pad string to center within given width
 */
function padCenter(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width)
  const leftPad = Math.floor((width - str.length) / 2)
  const rightPad = width - str.length - leftPad
  return ' '.repeat(leftPad) + str + ' '.repeat(rightPad)
}

/**
 * Pad string to right within given width
 */
function padRight(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width)
  return str + ' '.repeat(width - str.length)
}

/**
 * Generate a simple flow summary
 */
export function generateFlowSummary(config: LayerguardConfig): string {
  const lines: string[] = []

  lines.push('Layer dependencies:')
  lines.push('')

  for (const rule of config.flow) {
    lines.push(`  ${rule}`)
  }

  // Sublayer flows
  for (const [layerName, layerConfig] of Object.entries(config.layers)) {
    if (layerConfig.flow && layerConfig.flow.length > 0) {
      lines.push('')
      lines.push(`  ${layerName} sublayers:`)
      for (const rule of layerConfig.flow) {
        lines.push(`    ${rule}`)
      }
    }
  }

  return lines.join('\n')
}
