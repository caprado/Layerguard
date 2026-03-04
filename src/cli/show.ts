/**
 * layerguard show command
 *
 * Displays the architecture diagram
 */

import { loadConfig } from '../config/loader.js'
import { validateConfig } from '../config/validator.js'
import { generateDiagram, generateFlowSummary } from '../output/diagram.js'
import { formatError } from '../output/terminal.js'

/**
 * Options for the show command
 */
export interface ShowCommandOptions {
  /**
   * Project root directory
   */
  cwd?: string

  /**
   * Whether to use ASCII instead of Unicode
   */
  ascii?: boolean

  /**
   * Whether to show only flow rules (no diagram)
   */
  flowOnly?: boolean
}

/**
 * Run the show command
 */
export async function runShow(options: ShowCommandOptions = {}): Promise<void> {
  const { cwd = process.cwd(), ascii = false, flowOnly = false } = options

  try {
    // Load config
    const { config, configPath } = await loadConfig(cwd)

    // Validate (just for errors, we'll show the diagram anyway)
    const validation = validateConfig(config, cwd)
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => e.message).join('\n')
      console.error(formatError(`Invalid config at ${configPath}:\n${errorMessages}`))
      process.exit(1)
    }

    // Generate and print output
    if (flowOnly) {
      console.log(generateFlowSummary(config))
    } else {
      console.log(generateDiagram(config, { unicode: !ascii }))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(formatError(message))
    process.exit(1)
  }
}
