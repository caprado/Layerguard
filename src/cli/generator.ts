/**
 * Config file generator
 *
 * Generates layerguard.config.ts/js files from config objects
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { LayerguardConfig, LayerConfig } from '../config/types.js'

/**
 * Options for generating config
 */
export interface GenerateOptions {
  /**
   * Whether to generate TypeScript (.ts) or JavaScript (.js)
   */
  typescript?: boolean

  /**
   * Whether to include comments explaining the config
   */
  includeComments?: boolean
}

/**
 * Generate config file content
 */
export function generateConfigContent(
  config: LayerguardConfig,
  options: GenerateOptions = {}
): string {
  const { typescript = true, includeComments = true } = options
  const lines: string[] = []

  // Import statement
  if (typescript) {
    lines.push("import { defineConfig } from 'layerguard'")
  } else {
    lines.push(
      "// @ts-check",
      "/** @type {import('layerguard').LayerguardConfig} */"
    )
  }
  lines.push('')

  // Export
  if (typescript) {
    lines.push('export default defineConfig({')
  } else {
    lines.push('module.exports = {')
  }

  // Framework
  if (config.framework) {
    if (includeComments) {
      lines.push(
        '  // Framework enables special file handling (page.tsx, layout.tsx, etc.)'
      )
    }
    lines.push(`  framework: '${config.framework}',`)
    lines.push('')
  }

  // Layers
  if (includeComments) {
    lines.push('  // Define your architectural layers')
  }
  lines.push('  layers: {')

  const layerEntries = Object.entries(config.layers)
  for (let i = 0; i < layerEntries.length; i++) {
    const [name, layerConfig] = layerEntries[i]!
    const isLast = i === layerEntries.length - 1

    lines.push(...formatLayer(name, layerConfig, isLast))
  }

  lines.push('  },')
  lines.push('')

  // Flow rules
  if (includeComments) {
    lines.push('  // Dependency flow rules: A -> B means A can import from B')
  }
  lines.push('  flow: [')

  for (let i = 0; i < config.flow.length; i++) {
    const rule = config.flow[i]
    const isLast = i === config.flow.length - 1
    lines.push(`    '${rule}'${isLast ? '' : ','}`)
  }

  lines.push('  ],')

  // Rules
  if (config.rules) {
    lines.push('')
    if (includeComments) {
      lines.push('  // Additional rules')
    }
    lines.push('  rules: {')

    const ruleEntries = Object.entries(config.rules)
    for (let i = 0; i < ruleEntries.length; i++) {
      const [key, value] = ruleEntries[i]!
      const isLast = i === ruleEntries.length - 1
      lines.push(`    ${key}: '${value}'${isLast ? '' : ','}`)
    }

    lines.push('  },')
  }

  // Ignore patterns
  if (config.ignore && config.ignore.length > 0) {
    lines.push('')
    if (includeComments) {
      lines.push('  // Files and directories to ignore')
    }
    lines.push('  ignore: [')

    for (let i = 0; i < config.ignore.length; i++) {
      const pattern = config.ignore[i]
      const isLast = i === config.ignore.length - 1
      lines.push(`    '${pattern}'${isLast ? '' : ','}`)
    }

    lines.push('  ],')
  }

  // Close
  if (typescript) {
    lines.push('})')
  } else {
    lines.push('}')
  }

  lines.push('')
  return lines.join('\n')
}

/**
 * Format a single layer configuration
 */
function formatLayer(
  name: string,
  config: LayerConfig,
  isLast: boolean
): string[] {
  const lines: string[] = []

  // Check if it's a simple layer (just path) or complex (with sublayers/flow)
  const hasContent = config.sublayers || config.flow

  if (!hasContent) {
    // Simple layer: inline format
    lines.push(`    ${name}: { path: '${config.path}' }${isLast ? '' : ','}`)
  } else {
    // Complex layer: expanded format
    lines.push(`    ${name}: {`)
    lines.push(`      path: '${config.path}',`)

    if (config.sublayers) {
      lines.push('      sublayers: {')

      const subEntries = Object.entries(config.sublayers)
      for (let i = 0; i < subEntries.length; i++) {
        const [subName, subConfig] = subEntries[i]!
        const subIsLast = i === subEntries.length - 1

        if (subConfig.isolated) {
          lines.push(
            `        ${subName}: { path: '${subConfig.path}', isolated: true }${subIsLast ? '' : ','}`
          )
        } else {
          lines.push(
            `        ${subName}: { path: '${subConfig.path}' }${subIsLast ? '' : ','}`
          )
        }
      }

      lines.push('      },')
    }

    if (config.flow && config.flow.length > 0) {
      lines.push(`      flow: [${config.flow.map((r) => `'${r}'`).join(', ')}],`)
    }

    lines.push(`    }${isLast ? '' : ','}`)
  }

  return lines
}

/**
 * Write config file to disk
 */
export function writeConfigFile(
  projectRoot: string,
  config: LayerguardConfig,
  options: GenerateOptions = {}
): string {
  const { typescript = true } = options
  const filename = typescript ? 'layerguard.config.ts' : 'layerguard.config.js'
  const filepath = path.join(projectRoot, filename)

  const content = generateConfigContent(config, options)
  fs.writeFileSync(filepath, content, 'utf-8')

  return filepath
}

/**
 * Check if a config file already exists
 */
export function configFileExists(projectRoot: string): string | null {
  const candidates = [
    'layerguard.config.ts',
    'layerguard.config.js',
    'layerguard.config.mjs',
    'layerguard.config.cjs',
  ]

  for (const filename of candidates) {
    const filepath = path.join(projectRoot, filename)
    if (fs.existsSync(filepath)) {
      return filename
    }
  }

  return null
}
