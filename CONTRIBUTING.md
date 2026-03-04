# Contributing to Layerguard

Thank you for your interest in contributing to Layerguard! This document provides guidelines and information for contributors.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/layerguard.git
   cd layerguard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Project Structure

```
layerguard/
  src/
    cli/           # CLI commands (check, init, show)
    config/        # Config loading and validation
    parser/        # Import extraction and dependency graph
    enforcer/      # Layer mapping and rule checking
    plugins/       # Framework-specific plugins
    output/        # Formatters (terminal, CI, JSON)
  tests/
    unit/          # Unit tests
    integration/   # Integration tests with fixtures
  bin/
    layerguard.js    # CLI entry point
```

## Development Scripts

```bash
# Build TypeScript to JavaScript
npm run build

# Watch mode for development
npm run dev

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type check without emitting
npm run typecheck

# Run layerguard on itself (self-hosting test)
npm run test:self
```

## Writing Tests

- Place unit tests in `tests/unit/` mirroring the `src/` structure
- Use Vitest for all tests
- Aim for high coverage on core modules (`src/enforcer/`, `src/parser/`)

Example test:

```typescript
import { describe, it, expect } from 'vitest'
import { parseFlowRules } from '../../../src/config/parser.js'

describe('parseFlowRules', () => {
  it('should parse unidirectional flow', () => {
    const rules = parseFlowRules(['A -> B'])
    expect(rules[0]).toEqual({
      from: 'A',
      to: 'B',
      direction: 'unidirectional',
    })
  })
})
```

## Adding a Framework Plugin

Framework plugins help Layerguard understand framework-specific conventions. To add a new plugin:

1. **Create the plugin file** in `src/plugins/`:

```typescript
// src/plugins/my-framework.ts
import type { FrameworkPlugin } from './types.js'

export const myFrameworkPlugin: FrameworkPlugin = {
  name: 'My Framework',
  framework: 'my-framework',

  defaultIgnorePatterns: [
    'dist/**',
    '.cache/**',
  ],

  isImplicitlyUsed(filePath: string): boolean {
    // Return true for files that are "used" by the framework
    // without explicit imports (e.g., route files, config files)
    return false
  },

  shouldIgnore(filePath: string): boolean {
    // Return true for files that should be excluded from analysis
    return false
  },

  normalizePath(filePath: string): string {
    // Normalize paths (e.g., remove route groups)
    return filePath.replace(/\\/g, '/')
  },
}
```

2. **Register the plugin** in `src/plugins/registry.ts`:

```typescript
import { myFrameworkPlugin } from './my-framework.js'

const pluginRegistry = new Map<string, FrameworkPlugin>([
  // ... existing plugins
  ['my-framework', myFrameworkPlugin],
])
```

3. **Update the config types** in `src/config/types.ts`:

```typescript
framework?: 'nextjs-app' | 'nextjs-pages' | 'vite-react' | 'my-framework' | 'custom'
```

4. **Add tests** in `tests/unit/plugins/my-framework.test.ts`

5. **Update documentation** in README.md

## Pull Request Process

1. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** following the code style of the project

3. **Add tests** for new functionality

4. **Run the full test suite**:
   ```bash
   npm test
   npm run typecheck
   npm run test:self
   ```

5. **Update documentation** if needed

6. **Submit a pull request** with a clear description of the changes

## Code Style

- Use TypeScript strict mode
- Follow existing patterns in the codebase
- Keep functions small and focused
- Add JSDoc comments for public APIs
- Use meaningful variable and function names

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add Angular framework plugin
fix: handle circular imports in barrel files
docs: update CI integration examples
test: add edge case tests for sublayer flow
```

## Reporting Issues

When reporting issues, please include:

1. **Layerguard version** (`npx layerguard --version`)
2. **Node.js version** (`node --version`)
3. **TypeScript version** (`npx tsc --version`)
4. **Your config file** (redacted if needed)
5. **Steps to reproduce**
6. **Expected vs actual behavior**

## Questions?

Feel free to open an issue for questions or discussions about potential contributions.
