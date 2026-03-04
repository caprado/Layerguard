/**
 * Config validator
 *
 * Validates the archgate config structure and ensures all references are valid.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ArchgateConfig, LayerConfig, SublayerConfig } from './types.js'
import { parseFlowRules, buildFlowGraph, findIsolatedLayers, type FlowParseError } from './parser.js'
import type { FlowGraph, ParsedFlowRule } from './types.js'

export interface ValidationError {
  type: 'error' | 'warning'
  code: string
  message: string
  path?: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  flowGraph: FlowGraph | null
  parsedFlowRules: ParsedFlowRule[]
}

/**
 * Validate the archgate config
 *
 * @param config - The config to validate
 * @param cwd - The project root directory for path validation
 * @returns Validation result with errors, warnings, and parsed flow graph
 */
export function validateConfig(config: ArchgateConfig, cwd: string): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  let flowGraph: FlowGraph | null = null
  let parsedFlowRules: ParsedFlowRule[] = []

  // Validate required fields
  if (!config.layers || typeof config.layers !== 'object') {
    errors.push({
      type: 'error',
      code: 'MISSING_LAYERS',
      message: 'Config must have a "layers" object',
    })
  }

  if (!config.flow || !Array.isArray(config.flow)) {
    errors.push({
      type: 'error',
      code: 'MISSING_FLOW',
      message: 'Config must have a "flow" array',
    })
  }

  // If basic structure is invalid, return early
  if (errors.length > 0) {
    return { valid: false, errors, warnings, flowGraph: null, parsedFlowRules: [] }
  }

  // Collect all layer and sublayer names
  const layerNames = new Set<string>()
  const sublayerNames = new Map<string, Set<string>>() // parent layer -> sublayer names

  // Validate layers
  for (const [layerName, layerConfig] of Object.entries(config.layers)) {
    // Check for duplicate layer names (handled by object keys, but check sublayer overlap)
    if (layerNames.has(layerName)) {
      errors.push({
        type: 'error',
        code: 'DUPLICATE_LAYER',
        message: `Duplicate layer name: "${layerName}"`,
      })
    }
    layerNames.add(layerName)

    // Validate layer config
    const layerErrors = validateLayerConfig(layerName, layerConfig, cwd)
    errors.push(...layerErrors.filter((e) => e.type === 'error'))
    warnings.push(...layerErrors.filter((e) => e.type === 'warning'))

    // Collect sublayer names
    if (layerConfig.sublayers) {
      const sublayers = new Set<string>()
      for (const sublayerName of Object.keys(layerConfig.sublayers)) {
        sublayers.add(sublayerName)
      }
      sublayerNames.set(layerName, sublayers)
    }
  }

  // Parse and validate flow rules
  try {
    parsedFlowRules = parseFlowRules(config.flow)
    flowGraph = buildFlowGraph(parsedFlowRules)

    // Validate that all flow rule references exist
    for (const rule of parsedFlowRules) {
      if (!layerNames.has(rule.from)) {
        errors.push({
          type: 'error',
          code: 'UNKNOWN_LAYER_IN_FLOW',
          message: `Flow rule references unknown layer: "${rule.from}"`,
        })
      }
      if (!layerNames.has(rule.to)) {
        errors.push({
          type: 'error',
          code: 'UNKNOWN_LAYER_IN_FLOW',
          message: `Flow rule references unknown layer: "${rule.to}"`,
        })
      }
    }

    // Warn about isolated layers (no flow rules at all)
    const isolated = findIsolatedLayers(flowGraph)
    for (const layer of isolated) {
      // Only warn if the layer exists in config
      if (layerNames.has(layer)) {
        warnings.push({
          type: 'warning',
          code: 'ISOLATED_LAYER',
          message: `Layer "${layer}" has no flow rules defined. It is completely isolated.`,
        })
      }
    }

    // Check for layers defined but not in any flow rule
    for (const layerName of layerNames) {
      if (!flowGraph.has(layerName)) {
        warnings.push({
          type: 'warning',
          code: 'LAYER_NOT_IN_FLOW',
          message: `Layer "${layerName}" is defined but not referenced in any flow rule.`,
        })
      }
    }
  } catch (error) {
    if ((error as FlowParseError).name === 'FlowParseError') {
      errors.push({
        type: 'error',
        code: 'INVALID_FLOW_RULE',
        message: (error as Error).message,
      })
    } else {
      throw error
    }
  }

  // Validate sublayer flow rules
  for (const [layerName, layerConfig] of Object.entries(config.layers)) {
    if (layerConfig.flow && layerConfig.sublayers) {
      const sublayers = sublayerNames.get(layerName) ?? new Set()
      const sublayerFlowErrors = validateSublayerFlow(layerName, layerConfig.flow, sublayers)
      errors.push(...sublayerFlowErrors.filter((e) => e.type === 'error'))
      warnings.push(...sublayerFlowErrors.filter((e) => e.type === 'warning'))
    }
  }

  // Validate framework field if present
  if (config.framework !== undefined) {
    const validFrameworks = ['nextjs-app', 'nextjs-pages', 'vite-react', 'custom']
    if (!validFrameworks.includes(config.framework)) {
      errors.push({
        type: 'error',
        code: 'INVALID_FRAMEWORK',
        message: `Invalid framework: "${config.framework}". Valid options: ${validFrameworks.join(', ')}`,
      })
    }
  }

  // Validate rules config if present
  if (config.rules) {
    const rulesErrors = validateRulesConfig(config.rules)
    errors.push(...rulesErrors)
  }

  // Validate exceptions if present
  if (config.exceptions) {
    for (let i = 0; i < config.exceptions.length; i++) {
      const exception = config.exceptions[i]
      if (!exception) continue

      if (!exception.from) {
        errors.push({
          type: 'error',
          code: 'INVALID_EXCEPTION',
          message: `Exception at index ${i} is missing "from" field`,
        })
      }
      if (!exception.to) {
        errors.push({
          type: 'error',
          code: 'INVALID_EXCEPTION',
          message: `Exception at index ${i} is missing "to" field`,
        })
      }
      if (!exception.reason) {
        errors.push({
          type: 'error',
          code: 'INVALID_EXCEPTION',
          message: `Exception at index ${i} is missing "reason" field. Exceptions must be documented.`,
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    flowGraph: errors.length === 0 ? flowGraph : null,
    parsedFlowRules,
  }
}

/**
 * Validate a single layer configuration
 */
function validateLayerConfig(
  layerName: string,
  config: LayerConfig,
  cwd: string
): ValidationError[] {
  const errors: ValidationError[] = []

  // Check path is defined
  if (!config.path || typeof config.path !== 'string') {
    errors.push({
      type: 'error',
      code: 'MISSING_LAYER_PATH',
      message: `Layer "${layerName}" must have a "path" string`,
      path: layerName,
    })
    return errors
  }

  // Check path exists on disk
  const fullPath = resolve(cwd, config.path)
  if (!existsSync(fullPath)) {
    errors.push({
      type: 'warning',
      code: 'LAYER_PATH_NOT_FOUND',
      message: `Layer "${layerName}" path does not exist: ${config.path}`,
      path: config.path,
    })
  }

  // Validate sublayers if present
  if (config.sublayers) {
    for (const [sublayerName, sublayerConfig] of Object.entries(config.sublayers)) {
      const sublayerErrors = validateSublayerConfig(layerName, sublayerName, sublayerConfig, cwd)
      errors.push(...sublayerErrors)
    }
  }

  return errors
}

/**
 * Validate a single sublayer configuration
 */
function validateSublayerConfig(
  parentLayerName: string,
  sublayerName: string,
  config: SublayerConfig,
  cwd: string
): ValidationError[] {
  const errors: ValidationError[] = []

  // Check path is defined
  if (!config.path || typeof config.path !== 'string') {
    errors.push({
      type: 'error',
      code: 'MISSING_SUBLAYER_PATH',
      message: `Sublayer "${parentLayerName}.${sublayerName}" must have a "path" string`,
      path: `${parentLayerName}.${sublayerName}`,
    })
    return errors
  }

  // Check path exists on disk
  const fullPath = resolve(cwd, config.path)
  if (!existsSync(fullPath)) {
    errors.push({
      type: 'warning',
      code: 'SUBLAYER_PATH_NOT_FOUND',
      message: `Sublayer "${parentLayerName}.${sublayerName}" path does not exist: ${config.path}`,
      path: config.path,
    })
  }

  // Validate isolated field if present
  if (config.isolated !== undefined && typeof config.isolated !== 'boolean') {
    errors.push({
      type: 'error',
      code: 'INVALID_ISOLATED',
      message: `Sublayer "${parentLayerName}.${sublayerName}" isolated field must be a boolean`,
      path: `${parentLayerName}.${sublayerName}`,
    })
  }

  return errors
}

/**
 * Validate sublayer flow rules reference valid sublayers
 */
function validateSublayerFlow(
  layerName: string,
  flow: string[],
  sublayerNames: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = []

  try {
    const parsedRules = parseFlowRules(flow)

    for (const rule of parsedRules) {
      if (!sublayerNames.has(rule.from)) {
        errors.push({
          type: 'error',
          code: 'UNKNOWN_SUBLAYER_IN_FLOW',
          message: `Layer "${layerName}" flow rule references unknown sublayer: "${rule.from}"`,
        })
      }
      if (!sublayerNames.has(rule.to)) {
        errors.push({
          type: 'error',
          code: 'UNKNOWN_SUBLAYER_IN_FLOW',
          message: `Layer "${layerName}" flow rule references unknown sublayer: "${rule.to}"`,
        })
      }
    }
  } catch (error) {
    if ((error as FlowParseError).name === 'FlowParseError') {
      errors.push({
        type: 'error',
        code: 'INVALID_SUBLAYER_FLOW_RULE',
        message: `Layer "${layerName}": ${(error as Error).message}`,
      })
    } else {
      throw error
    }
  }

  return errors
}

/**
 * Validate rules configuration
 */
function validateRulesConfig(rules: NonNullable<ArchgateConfig['rules']>): ValidationError[] {
  const errors: ValidationError[] = []

  if (rules.circular !== undefined) {
    const validValues = ['error', 'warn', 'off']
    if (!validValues.includes(rules.circular)) {
      errors.push({
        type: 'error',
        code: 'INVALID_RULES_CIRCULAR',
        message: `Invalid rules.circular value: "${rules.circular}". Valid options: ${validValues.join(', ')}`,
      })
    }
  }

  if (rules.orphans !== undefined) {
    const validValues = ['error', 'warn', 'off']
    if (!validValues.includes(rules.orphans)) {
      errors.push({
        type: 'error',
        code: 'INVALID_RULES_ORPHANS',
        message: `Invalid rules.orphans value: "${rules.orphans}". Valid options: ${validValues.join(', ')}`,
      })
    }
  }

  if (rules.typeOnlyImports !== undefined) {
    const validValues = ['enforce', 'ignore']
    if (!validValues.includes(rules.typeOnlyImports)) {
      errors.push({
        type: 'error',
        code: 'INVALID_RULES_TYPE_ONLY',
        message: `Invalid rules.typeOnlyImports value: "${rules.typeOnlyImports}". Valid options: ${validValues.join(', ')}`,
      })
    }
  }

  return errors
}
