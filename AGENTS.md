# Archgate Development Guide for Agentic Coding Agents

This guide provides essential information for agentic coding agents working with the Archgate codebase.

## Project Overview

Archgate is a framework-agnostic CLI tool that enforces architectural layer boundaries in TypeScript/JavaScript projects. It helps maintain clean architecture by preventing inappropriate dependencies between layers.

## Build Commands

```bash
# Build the project
pnpm build

# Watch mode for development
pnpm dev

# Type checking
pnpm typecheck
```

## Linting Commands

```bash
# Run ESLint
pnpm lint

# Run linter with auto-fix
pnpm lint -- --fix
```

## Testing Commands

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage

# Run self-check (archgate checking itself)
pnpm test:self

# Run a single test file
pnpm test -- tests/unit/cli/check.test.ts

# Run tests matching a pattern
pnpm test -- -t="checkEdge"

# Run a single test suite
pnpm test -- tests/unit/enforcer/checker.test.ts -t="FlowChecker"
```

## Code Style Guidelines

### Imports

1. Use ES modules with `.js` extensions in import specifiers
2. Group imports in this order:
   - Node.js built-ins
   - External packages
   - Internal modules (relative paths)
3. Use type-only imports when importing only for types: `import type { Type } from './module.js'`
4. Avoid wildcard imports unless necessary

### Formatting

1. Use 2 spaces for indentation (no tabs)
2. Prefer single quotes for strings
3. Always use semicolons
4. Trailing commas in multi-line objects/arrays
5. Maximum line length of 100 characters

### Types

1. Use TypeScript for all source files
2. Enable strict mode (all strict options)
3. Prefer interfaces over types for object shapes
4. Use `type` aliases for unions, primitives, and tuples
5. Explicitly type all function parameters and return values
6. Use `unknown` instead of `any` when the type is truly unknown

### Naming Conventions

1. Use camelCase for variables and functions
2. Use PascalCase for classes, interfaces, and types
3. Use UPPER_SNAKE_CASE for constants
4. Use descriptive names - prefer `userRepository` over `repo`
5. Prefix boolean variables with `is`, `has`, or `should` when appropriate
6. Use verbs for function names (`getUser`, `validateConfig`)

### Error Handling

1. Always handle errors appropriately - no silent failures
2. Create custom error classes that extend `Error` for specific error types
3. Include meaningful error messages with context
4. Use `instanceof` checks when catching specific error types
5. Log errors with sufficient context for debugging

### Documentation

1. Export all public APIs with JSDoc comments
2. Document complex logic with inline comments
3. Use clear, concise language in comments
4. Keep documentation up to date with code changes

### Architecture Patterns

1. Follow the existing modular structure with clear separation of concerns
2. Use dependency injection where appropriate
3. Prefer pure functions and immutable data when possible
4. Keep modules focused on a single responsibility
5. Use the existing config/loader pattern for loading configuration files

## File Structure

- `src/` - Main source code
- `src/cache/` - Caching for incremental checking
- `src/cli/` - Command line interface
- `src/config/` - Configuration loading and validation
- `src/enforcer/` - Architecture rule enforcement
- `src/eslint/` - ESLint integration
- `src/output/` - Result formatting and output
- `src/parser/` - File parsing and dependency extraction
- `src/plugins/` - Framework plugins
- `src/workspace/` - Monorepo workspace detection
- `tests/` - Unit tests (mirrors src/ structure)
- `tests/fixtures/` - Test fixtures and example projects

## Testing Guidelines

1. Use Vitest for all tests
2. Place test files in `tests/unit/` mirroring the `src/` structure (e.g., `src/cli/check.ts` → `tests/unit/cli/check.test.ts`)
3. Use descriptive test names that explain the expected behavior
4. Test both positive and negative cases
5. Mock external dependencies
6. Use test fixtures for complex scenarios
7. Test edge cases and error conditions

## Debugging

1. Use `console.log` for temporary debugging (remove before committing)
2. Use the `--no-cache` flag when testing to ensure fresh runs

## Release Process

1. Update version in `package.json`
2. Run `pnpm build` to ensure build works
3. Run all tests with `pnpm test`
4. Commit changes
5. Create git tag with version
6. Publish to npm with `pnpm publish`

## Integration with Frameworks

The project supports various frameworks through plugins. When adding new framework support:

1. Create a new plugin in `src/plugins/`
2. Implement the `FrameworkPlugin` interface
3. Add the framework to the config type definitions
4. Add tests for the new framework
5. Update documentation

## Performance Considerations

1. Use caching where appropriate (see existing cache implementations)
2. Avoid expensive operations in hot paths
3. Use incremental processing when possible
4. Profile performance with large codebases