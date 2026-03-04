/**
 * ESLint rule: archgate/layer-boundaries
 *
 * Flags imports that violate flow rules defined in archgate config.
 */

import type { Rule } from 'eslint'
import { relative } from 'node:path'
import { getConfig } from '../config-cache.js'
import { createLayerMapper, type LayerMapper } from '../../enforcer/mapper.js'
import { parseFlowRules } from '../../config/parser.js'
import { createResolverContext, resolveImport, type ResolverContext } from '../../parser/resolver.js'

/**
 * Layer boundaries rule
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce architectural layer boundaries defined in archgate config',
      recommended: true,
    },
    messages: {
      violation:
        'Import from "{{importPath}}" violates layer boundaries: {{fromLayer}} cannot import from {{toLayer}}',
      noConfig: 'No archgate configuration found',
    },
    schema: [
      {
        type: 'object',
        properties: {
          configPath: {
            type: 'string',
            description: 'Path to archgate config file',
          },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const filename = context.filename
    const cachedConfig = getConfig(filename)

    if (!cachedConfig) {
      // No config found - don't report, just skip
      return {}
    }

    const { config, projectRoot } = cachedConfig
    const relativeFilePath = relative(projectRoot, filename).replace(/\\/g, '/')

    // Create layer mapper
    const mapper = createLayerMapper(config)
    const sourceMapping = mapper.map(relativeFilePath)

    // If source file is not in any layer, skip checking
    if (!sourceMapping) {
      return {}
    }

    const sourceLayer = sourceMapping.layer

    // Parse flow rules
    const flowRules = parseFlowRules(config.flow)

    // Create resolver context
    const resolverContext = createResolverContext(projectRoot, config.tsconfig)

    // Build allowed targets set for this layer
    const allowedTargets = new Set<string>()
    for (const flowRule of flowRules) {
      if (flowRule.from === sourceLayer) {
        allowedTargets.add(flowRule.to)
      }
      if (flowRule.direction === 'bidirectional' && flowRule.to === sourceLayer) {
        allowedTargets.add(flowRule.from)
      }
    }

    return {
      ImportDeclaration(node) {
        if (!node.source || typeof node.source.value !== 'string') {
          return
        }

        const specifier = node.source.value
        checkImport(context, specifier, node.source.loc!, {
          filename,
          projectRoot,
          sourceLayer,
          allowedTargets,
          mapper,
          resolverContext,
        })
      },

      CallExpression(node) {
        // Handle require() calls
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length > 0 &&
          node.arguments[0]?.type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          const specifier = node.arguments[0].value
          const loc = node.arguments[0].loc!
          checkImport(context, specifier, loc, {
            filename,
            projectRoot,
            sourceLayer,
            allowedTargets,
            mapper,
            resolverContext,
          })
        }
      },

      // Handle dynamic imports
      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          const specifier = node.source.value
          const loc = node.source.loc!
          checkImport(context, specifier, loc, {
            filename,
            projectRoot,
            sourceLayer,
            allowedTargets,
            mapper,
            resolverContext,
          })
        }
      },
    }
  },
}

interface CheckContext {
  filename: string
  projectRoot: string
  sourceLayer: string
  allowedTargets: Set<string>
  mapper: LayerMapper
  resolverContext: ResolverContext
}

function checkImport(
  context: Rule.RuleContext,
  specifier: string,
  loc: { start: { line: number; column: number }; end: { line: number; column: number } },
  checkCtx: CheckContext
): void {
  const { filename, projectRoot, sourceLayer, allowedTargets, mapper, resolverContext } = checkCtx

  // Resolve the import
  const resolved = resolveImport(specifier, filename, resolverContext)

  // Skip external or unresolved imports
  if (resolved.isExternal || resolved.isUnresolved || !resolved.resolvedPath) {
    return
  }

  // Get relative path of target
  const targetRelative = relative(projectRoot, resolved.resolvedPath).replace(/\\/g, '/')

  // Get target layer
  const targetMapping = mapper.map(targetRelative)

  // Skip if target is not in any layer
  if (!targetMapping) {
    return
  }

  const targetLayer = targetMapping.layer

  // Skip if same layer
  if (targetLayer === sourceLayer) {
    return
  }

  // Check if this import is allowed
  if (!allowedTargets.has(targetLayer)) {
    context.report({
      loc,
      messageId: 'violation',
      data: {
        importPath: specifier,
        fromLayer: sourceLayer,
        toLayer: targetLayer,
      },
    })
  }
}

export default rule
