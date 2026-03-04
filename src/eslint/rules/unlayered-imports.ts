/**
 * ESLint rule: layerguard/unlayered-imports
 *
 * Flags imports from layered files to unlayered files when the
 * unlayeredImports rule is set to 'error' or 'warn' in layerguard config.
 */

import type { Rule } from 'eslint'
import { relative } from 'node:path'
import { getConfig } from '../config-cache.js'
import { createLayerMapper, type LayerMapper } from '../../enforcer/mapper.js'
import { createResolverContext, resolveImport, type ResolverContext } from '../../parser/resolver.js'

/**
 * Unlayered imports rule
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Flag imports from layered files to unlayered files',
      recommended: false,
    },
    messages: {
      unlayeredImport:
        'Import from "{{importPath}}" targets an unlayered file ({{targetPath}}). Add this file to a layer or update ignore patterns.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          configPath: {
            type: 'string',
            description: 'Path to layerguard config file',
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
      return {}
    }

    const { config, projectRoot } = cachedConfig

    // Check if unlayeredImports rule is enabled
    const unlayeredSetting = config.rules?.unlayeredImports ?? 'ignore'
    if (unlayeredSetting === 'ignore') {
      return {}
    }

    const relativeFilePath = relative(projectRoot, filename).replace(/\\/g, '/')

    // Create layer mapper
    const mapper = createLayerMapper(config)
    const sourceMapping = mapper.map(relativeFilePath)

    // Only check imports from layered files
    if (!sourceMapping) {
      return {}
    }

    // Create resolver context
    const resolverContext = createResolverContext(projectRoot, config.tsconfig)

    return {
      ImportDeclaration(node) {
        if (!node.source || typeof node.source.value !== 'string') {
          return
        }

        const specifier = node.source.value
        checkUnlayeredImport(context, specifier, node.source.loc!, {
          filename,
          projectRoot,
          mapper,
          resolverContext,
        })
      },

      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length > 0 &&
          node.arguments[0]?.type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          const specifier = node.arguments[0].value
          const loc = node.arguments[0].loc!
          checkUnlayeredImport(context, specifier, loc, {
            filename,
            projectRoot,
            mapper,
            resolverContext,
          })
        }
      },

      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          const specifier = node.source.value
          const loc = node.source.loc!
          checkUnlayeredImport(context, specifier, loc, {
            filename,
            projectRoot,
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
  mapper: LayerMapper
  resolverContext: ResolverContext
}

function checkUnlayeredImport(
  context: Rule.RuleContext,
  specifier: string,
  loc: { start: { line: number; column: number }; end: { line: number; column: number } },
  checkCtx: CheckContext
): void {
  const { filename, projectRoot, mapper, resolverContext } = checkCtx

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

  // Report if target is not in any layer
  if (!targetMapping) {
    context.report({
      loc,
      messageId: 'unlayeredImport',
      data: {
        importPath: specifier,
        targetPath: targetRelative,
      },
    })
  }
}

export default rule
