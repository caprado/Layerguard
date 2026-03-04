<p align="center">
  <img src="https://img.shields.io/npm/v/layerguard" alt="npm version">
  <img src="https://img.shields.io/github/actions/workflow/status/caprado/layerguard/ci.yml?branch=main" alt="build status">
  <img src="https://img.shields.io/npm/l/layerguard" alt="license">
  <img src="https://img.shields.io/node/v/layerguard" alt="node version">
</p>

# Layerguard

Architectural layer enforcement for TypeScript and JavaScript projects.

Layerguard prevents architectural violations before they happen. Define your layers, declare how dependencies can flow between them, and Layerguard enforces those rules in CI, pre-commit hooks, or your editor.

## Why Layerguard?

- **Catch violations early** - Get instant feedback when code violates your architecture
- **Framework-agnostic** - Works with Next.js, Vite, Angular, Node backends, and more
- **Fast incremental checking** - Only re-checks files that changed
- **Zero runtime impact** - Static analysis only, no runtime dependencies
- **Monorepo ready** - First-class workspace support for pnpm, npm, and Yarn workspaces
- **ESLint integration** - Inline editor feedback alongside your other linting rules

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Layers](#layers)
  - [Flow Rules](#flow-rules)
  - [Sublayers and Isolation](#sublayers-and-isolation)
  - [Public API Enforcement](#public-api-enforcement)
  - [Rules](#rules)
  - [Exceptions](#exceptions)
  - [Ignore Patterns](#ignore-patterns)
- [CLI Commands](#cli-commands)
  - [check](#check)
  - [show](#show)
  - [init](#init)
  - [report](#report)
- [Monorepo Support](#monorepo-support)
- [Framework Support](#framework-support)
- [ESLint Integration](#eslint-integration)
- [GitHub Actions](#github-actions)
- [VS Code Extension](#vs-code-extension)
- [Programmatic API](#programmatic-api)
- [License](#license)

## Installation

```bash
npm install --save-dev layerguard
```

Or with your preferred package manager:

```bash
pnpm add -D layerguard
yarn add -D layerguard
```

**Requirements:** Node.js 18.0.0 or higher, TypeScript 4.7.0 or higher

## Quick Start

Run the interactive setup wizard:

```bash
npx layerguard init
```

The wizard detects your project structure, suggests layers, and generates `layerguard.config.ts`.

Then validate your architecture:

```bash
npx layerguard check
```

If code violates the rules:

```
layerguard check

  ✗ 1 violation

  ERROR  Layer violation: repository -> services
  src/repository/users.ts:3 -> src/services/auth.ts

  Repository cannot import from services.
```

## Configuration

Create `layerguard.config.ts` in your project root:

```typescript
import { defineConfig } from 'layerguard'

export default defineConfig({
  layers: {
    handlers:   { path: 'src/handlers/' },
    services:   { path: 'src/services/' },
    repository: { path: 'src/repository/' },
  },

  flow: [
    'handlers -> services',
    'services -> repository',
  ],
})
```

### Layers

Each layer represents an architectural tier in your project:

```typescript
layers: {
  // Layer name -> configuration
  pages:      { path: 'src/pages/' },
  components: { path: 'src/components/' },
  hooks:      { path: 'src/hooks/' },
  utils:      { path: 'src/utils/' },
}
```

Files within a layer directory belong to that layer. Files outside all layers are "unlayered" and can be handled via the `unlayeredImports` rule.

### Flow Rules

Flow rules define allowed dependency directions:

```typescript
flow: [
  'pages -> components',      // pages can import from components
  'pages -> hooks',           // pages can import from hooks
  'components -> hooks',      // components can import from hooks
  'hooks <-> utils',          // bidirectional: hooks and utils can import each other
]
```

- `A -> B` - Unidirectional: A can import from B, but B cannot import from A
- `A <-> B` - Bidirectional: A and B can import from each other

Any import not explicitly allowed is a violation.

### Sublayers and Isolation

Layers can contain sublayers with their own rules:

```typescript
layers: {
  components: {
    path: 'src/components/',
    sublayers: {
      features: { path: 'src/components/features/', isolated: true },
      shared:   { path: 'src/components/shared/' },
    },
    flow: ['features -> shared'],
  },
}
```

With `isolated: true`, sibling directories within the sublayer cannot import from each other. For example, `features/auth/` cannot import from `features/billing/`.

### Public API Enforcement

Restrict which files can be imported from outside a layer:

```typescript
layers: {
  services: {
    path: 'src/services/',
    publicApi: 'index.ts',  // Only index.ts can be imported from outside
  },
}
```

Other files within the layer become private. This encourages clean module boundaries.

You can specify multiple public files:

```typescript
publicApi: ['index.ts', 'types.ts']
```

### Rules

Configure additional architectural checks:

```typescript
rules: {
  // Circular dependency detection
  circular: 'error',           // 'error' | 'warn' | 'off' (default: 'error')

  // Orphan file detection (files not imported anywhere)
  orphans: 'warn',             // 'error' | 'warn' | 'off' (default: 'off')

  // Whether to enforce rules on type-only imports
  typeOnlyImports: 'ignore',   // 'enforce' | 'ignore' (default: 'ignore')

  // Imports from layered files to unlayered files
  unlayeredImports: 'warn',    // 'error' | 'warn' | 'ignore' (default: 'ignore')

  // How to resolve barrel re-exports
  barrelResolution: 'import-site',  // 'import-site' | 'origin' (default: 'import-site')

  // Workspace package import handling
  workspaceImports: 'ignore',  // 'enforce' | 'ignore' (default: 'ignore')

  // Maximum import chain depth (transitive imports)
  maxImportDepth: 5,           // Warns if exceeded

  // Maximum imports per file
  maxImportsPerFile: 20,       // Warns if exceeded
}
```

**Barrel Resolution Modes:**
- `import-site` - Check against where the import points (e.g., `services/index.ts`)
- `origin` - Trace re-exports to their source file (catches hidden violations through barrels)

### Exceptions

Document exceptions when violations are intentional:

```typescript
exceptions: [
  {
    from: 'src/repository/users.ts',
    to: 'src/services/auth.ts',
    reason: 'User repository needs auth service for password hashing',
  },
  {
    from: 'src/legacy/**/*.ts',
    to: 'src/**/*.ts',
    reason: 'Legacy code is being migrated gradually',
  },
]
```

Exceptions require a `reason` - this serves as living documentation for architectural decisions.

### Ignore Patterns

Exclude files from analysis:

```typescript
ignore: [
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/mocks/**',
  '**/fixtures/**',
]
```

### TypeScript Configuration

Specify custom tsconfig path(s):

```typescript
// Single tsconfig
tsconfig: 'tsconfig.app.json',

// Multiple tsconfigs (merged)
tsconfig: ['tsconfig.app.json', 'tsconfig.server.json'],
```

## CLI Commands

### check

Validate architecture rules:

```bash
layerguard check [options]
```

| Option | Description |
|--------|-------------|
| `--ci` | Output in GitHub Actions annotation format |
| `--json` | Output violations as JSON |
| `--no-color` | Disable colored output |
| `--type-only` | Enforce rules on type-only imports |
| `--watch`, `-w` | Watch mode: re-check on file changes |
| `--no-cache` | Disable incremental caching |
| `--package`, `-p` | Check a specific workspace package |
| `--all` | Check all workspace packages |
| `--github-pr-comment` | Post results as a PR comment |
| `--pr-number` | PR number for comment (auto-detected in CI) |

**Examples:**

```bash
layerguard check                     # Standard check
layerguard check --ci                # GitHub Actions annotations
layerguard check --json              # JSON output for tooling
layerguard check --watch             # Watch mode
layerguard check --package apps/web  # Check specific package
layerguard check --all               # Check all packages in monorepo
```

### show

Display architecture diagram:

```bash
layerguard show [options]
```

| Option | Description |
|--------|-------------|
| `--ascii` | Use ASCII characters instead of Unicode |
| `--flow-only` | Show only flow rules, no diagram |

### init

Interactive setup wizard:

```bash
layerguard init [options]
```

| Option | Description |
|--------|-------------|
| `-y`, `--yes` | Skip prompts and use detected defaults |

### report

Generate HTML or Markdown report:

```bash
layerguard report [options]
```

| Option | Description |
|--------|-------------|
| `--output`, `-o` | Output file path (default: `layerguard-report.html`) |
| `--markdown`, `--md` | Output as Markdown instead of HTML |
| `--stdout` | Print to stdout instead of file |
| `--from` | Load historical data from JSON for trend charts |
| `--title` | Custom report title |

**Examples:**

```bash
layerguard report                          # Generate HTML report
layerguard report --markdown               # Markdown summary
layerguard report -o reports/arch.html     # Custom output path
layerguard report --from history.json      # Include trend data
```

## Monorepo Support

Layerguard detects pnpm, npm, and Yarn workspaces automatically.

### Per-package Configuration

Each package can have its own `layerguard.config.ts`:

```
my-monorepo/
├── package.json          # workspaces: ["packages/*", "apps/*"]
├── packages/
│   └── shared/
│       └── layerguard.config.ts
└── apps/
    └── web/
        └── layerguard.config.ts
```

### Check Specific Package

```bash
# By name
layerguard check --package @myorg/web

# By path
layerguard check --package apps/web
```

### Check All Packages

```bash
layerguard check --all
```

This finds all packages with `layerguard.config.ts` and checks them in sequence.

### Cross-package Imports

By default, workspace package imports (e.g., `import { foo } from '@myorg/shared'`) are treated like external packages. Enable cross-package enforcement with:

```typescript
rules: {
  workspaceImports: 'enforce',
}
```

## Framework Support

Set `framework` to enable framework-specific intelligence:

```typescript
export default defineConfig({
  framework: 'nextjs-app',
  // ...
})
```

| Value | Framework |
|-------|-----------|
| `nextjs-app` | Next.js App Router (`page.tsx`, `layout.tsx`, `route.ts`) |
| `nextjs-pages` | Next.js Pages Router (`_app.tsx`, `_document.tsx`) |
| `vite-react` | Vite + React (`main.tsx`, `vite.config.ts`) |
| `vite-react-router` | Vite + React Router file conventions |
| `vite-tanstack-router` | Vite + TanStack Router file conventions |
| `vue-nuxt` | Nuxt directory structure |
| `angular` | Angular module conventions |
| `node-backend` | Node.js backend patterns |
| `custom` | Manual configuration only |

Framework detection enables:
- Entry point recognition (excluded from orphan detection)
- Framework-specific file patterns
- Better layer suggestions in `layerguard init`

## ESLint Integration

Get inline editor feedback with the ESLint plugin:

```javascript
// eslint.config.js
import layerguard from 'layerguard/eslint'

export default [
  ...layerguard.configs.recommended,
  // your other config...
]
```

The plugin reads your `layerguard.config.ts` and reports violations as you type.

## GitHub Actions

Add to your CI workflow:

```yaml
name: Architecture Check

on: [push, pull_request]

jobs:
  layerguard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx layerguard check --ci
```

The `--ci` flag outputs GitHub Actions annotations, showing violations inline in the PR diff.

### PR Comments

Post a summary comment on pull requests:

```yaml
- run: npx layerguard check --github-pr-comment
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This requires the `gh` CLI (pre-installed on GitHub-hosted runners).

## VS Code Extension

Install the [Layerguard extension](https://marketplace.visualstudio.com/items?itemName=layerguard.layerguard-vscode) for:

- Inline diagnostics showing violations as you type
- Quick fixes for common issues
- Hover information showing layer relationships

## Programmatic API

Use Layerguard programmatically in your tools:

```typescript
import { loadConfig, validateConfig } from 'layerguard/config'
import { buildDependencyGraph } from 'layerguard/parser'
import { createFlowChecker } from 'layerguard/enforcer'

// Load and validate config
const { config } = await loadConfig(process.cwd())
const validation = validateConfig(config, process.cwd())

if (!validation.valid) {
  console.error(validation.errors)
  process.exit(1)
}

// Build dependency graph
const graph = buildDependencyGraph({
  projectRoot: process.cwd(),
  include: ['src/**/*.ts'],
})

// Check for violations
const checker = createFlowChecker(config)
const result = checker.checkGraph(graph)

console.log(`Found ${result.violations.length} violations`)
```

### Exports

| Export | Description |
|--------|-------------|
| `layerguard` | Main entry point |
| `layerguard/config` | Config loading and validation |
| `layerguard/parser` | Dependency graph building |
| `layerguard/enforcer` | Violation checking |
| `layerguard/plugins` | Framework plugin interfaces |
| `layerguard/eslint` | ESLint plugin |

## License

[MIT](LICENSE)
