# Plugin Contribution Guide

This guide explains how to create framework plugins for Layerguard.

## Overview

Framework plugins provide framework-specific intelligence for:
- **Implicit file usage**: Files that are used by framework conventions (e.g., filesystem routing)
- **Ignore patterns**: Files that should be excluded from checks (e.g., build output)
- **Path normalization**: Handling framework-specific path patterns

## Plugin Interface

Every plugin implements the `FrameworkPlugin` interface:

```typescript
interface FrameworkPlugin {
  // Display name for the plugin
  name: string

  // Framework identifier (used in config.framework)
  framework: string

  // Check if a file is implicitly used by the framework
  isImplicitlyUsed?(filePath: string): boolean

  // Check if a file should be ignored by the checker
  shouldIgnore?(filePath: string): boolean

  // Default ignore patterns for this framework
  defaultIgnorePatterns?: string[]

  // Check if a path segment is a route group (optional)
  isRouteGroup?(segment: string): boolean

  // Normalize a file path (optional)
  normalizePath?(filePath: string): string
}
```

## Creating a New Plugin

### 1. Create the Plugin File

Create a new file in `src/plugins/` named after your framework:

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
    const normalized = filePath.replace(/\\/g, '/')

    // Entry points
    if (normalized === 'src/main.ts') return true

    // Framework-specific conventions
    if (normalized.startsWith('src/routes/')) return true

    return false
  },

  shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    const segments = normalized.split('/')

    if (segments[0] === 'dist') return true
    if (segments[0] === '.cache') return true

    return false
  },

  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/')
  },
}

export default myFrameworkPlugin
```

### 2. Register the Plugin

Add your plugin to the registry in `src/plugins/registry.ts`:

```typescript
import { myFrameworkPlugin } from './my-framework.js'

const pluginRegistry = new Map<string, FrameworkPlugin>([
  // ... existing plugins
  ['my-framework', myFrameworkPlugin],
])
```

### 3. Update Config Types

Add your framework to the allowed values in `src/config/types.ts`:

```typescript
framework?:
  | 'nextjs-app'
  | 'nextjs-pages'
  // ... existing frameworks
  | 'my-framework'
  | 'custom'
```

### 4. Write Tests

Create tests in `tests/unit/plugins/my-framework.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { myFrameworkPlugin } from '../../../src/plugins/my-framework.js'

describe('myFrameworkPlugin', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      expect(myFrameworkPlugin.name).toBe('My Framework')
    })

    it('has correct framework identifier', () => {
      expect(myFrameworkPlugin.framework).toBe('my-framework')
    })
  })

  describe('isImplicitlyUsed', () => {
    it('returns true for entry points', () => {
      expect(myFrameworkPlugin.isImplicitlyUsed?.('src/main.ts')).toBe(true)
    })

    it('returns true for route files', () => {
      expect(myFrameworkPlugin.isImplicitlyUsed?.('src/routes/index.ts')).toBe(true)
    })

    it('returns false for regular files', () => {
      expect(myFrameworkPlugin.isImplicitlyUsed?.('src/utils/helpers.ts')).toBe(false)
    })
  })

  describe('shouldIgnore', () => {
    it('returns true for dist directory', () => {
      expect(myFrameworkPlugin.shouldIgnore?.('dist/main.js')).toBe(true)
    })

    it('returns false for source files', () => {
      expect(myFrameworkPlugin.shouldIgnore?.('src/main.ts')).toBe(false)
    })
  })
})
```

## Best Practices

### Path Normalization
Always normalize paths to forward slashes at the start of your methods:
```typescript
const normalized = filePath.replace(/\\/g, '/')
```

### File Extensions
Consider multiple file extensions:
```typescript
if (
  normalized.endsWith('.ts') ||
  normalized.endsWith('.tsx') ||
  normalized.endsWith('.js') ||
  normalized.endsWith('.jsx')
) {
  // ...
}
```

### Segment-Based Matching
For directory-based checks, split the path:
```typescript
const segments = normalized.split('/')
if (segments[0] === 'src' && segments[1] === 'routes') {
  return true
}
```

### Regular Expressions
For complex patterns, use regex:
```typescript
const ROUTE_PATTERN = /^src\/routes\/.*\.(tsx?|jsx?)$/
if (ROUTE_PATTERN.test(normalized)) {
  return true
}
```

## Existing Plugins

Reference these existing plugins for patterns:

| Plugin | File | Key Features |
|--------|------|--------------|
| Next.js App Router | `nextjs-app.ts` | Route groups, special files (page, layout, loading) |
| Next.js Pages | `nextjs-pages.ts` | Pages directory, API routes |
| Vite + React | `vite-react.ts` | Entry points, vite config |
| Vite + React Router | `vite-react-router.ts` | File-based routing |
| Vite + TanStack Router | `vite-tanstack-router.ts` | Generated route tree |
| Node.js Backend | `node-backend.ts` | Routes, controllers, middleware |
| Vue / Nuxt | `vue-nuxt.ts` | .vue files, auto-imports, pages |
| Angular | `angular.ts` | Components, modules, services, guards |

## Submitting Your Plugin

1. Fork the repository
2. Create your plugin following this guide
3. Ensure all tests pass: `npm test`
4. Submit a pull request

Your plugin will be reviewed and merged to make it available for all Layerguard users.
