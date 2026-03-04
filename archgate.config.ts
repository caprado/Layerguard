/**
 * Archgate configuration for the archgate project itself (dogfooding)
 */
import { defineConfig } from './src/config/types.js'

export default defineConfig({
  layers: {
    cli: { path: 'src/cli' },
    config: { path: 'src/config' },
    parser: { path: 'src/parser' },
    enforcer: { path: 'src/enforcer' },
    plugins: { path: 'src/plugins' },
    output: { path: 'src/output' },
    workspace: { path: 'src/workspace' },
    cache: { path: 'src/cache' },
    eslint: { path: 'src/eslint' },
  },

  flow: [
    // CLI can use everything
    'cli -> config',
    'cli -> parser',
    'cli -> enforcer',
    'cli -> plugins',
    'cli -> output',
    'cli -> workspace',

    // Enforcer depends on config, parser, and plugins
    'enforcer -> config',
    'enforcer -> parser',
    'enforcer -> plugins',

    // Parser depends on config and workspace
    'parser -> config',
    'parser -> workspace',

    // Output depends on enforcer and config
    'output -> enforcer',
    'output -> config',

    // Plugins depend on enforcer
    'plugins -> enforcer',
    'plugins -> config',

    // Workspace depends on config
    'workspace -> config',

    // Cache is standalone infrastructure
    'parser -> cache',

    // ESLint plugin depends on config, enforcer, and parser
    'eslint -> config',
    'eslint -> enforcer',
    'eslint -> parser',
  ],

  rules: {
    circular: 'error',
    orphans: 'off',
    typeOnlyImports: 'ignore',
  },

  ignore: [
    '**/*.test.ts',
    '**/*.spec.ts',
    'tests/**',
    'dist/**',
    // Barrel export file - it intentionally imports from all layers
    'src/index.ts',
    // CLI entry point
    'bin/**',
    // Config file itself
    'archgate.config.ts',
    // VS Code extension has its own architecture
    'vscode-extension/**',
  ],
})
