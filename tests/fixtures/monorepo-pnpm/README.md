# Monorepo (pnpm) Fixture

Tests workspace detection and per-package configuration in a pnpm monorepo.

## Structure

```
monorepo-pnpm/
├── pnpm-workspace.yaml      # Defines workspace packages
├── package.json             # Root package with workspaces
├── tsconfig.json            # Root tsconfig with path mappings
├── packages/
│   ├── web-api/            # Backend API package
│   │   ├── archgate.config.ts
│   │   └── src/
│   │       ├── handlers/
│   │       └── services/
│   ├── shared-utils/       # Shared utilities
│   │   ├── archgate.config.ts
│   │   └── src/
│   │       ├── helpers/
│   │       └── validators/
│   └── ui-components/      # UI component library
│       ├── archgate.config.ts
│       └── src/
│           ├── components/
│           └── hooks/
└── apps/
    └── web/                # Web application
        ├── archgate.config.ts
        └── src/
            ├── pages/
            └── components/
```

## Package Configurations

### @monorepo/web-api
```typescript
layers: {
  handlers: { path: 'src/handlers' },
  services: { path: 'src/services' },
}
flow: ['handlers -> services']
```

### @monorepo/shared-utils
```typescript
layers: {
  helpers: { path: 'src/helpers' },
  validators: { path: 'src/validators' },
}
flow: ['helpers -> validators']
```

### @monorepo/ui-components
```typescript
layers: {
  components: { path: 'src/components' },
  hooks: { path: 'src/hooks' },
}
flow: ['components -> hooks']
```

### @monorepo/web-app
```typescript
layers: {
  pages: { path: 'src/pages' },
  components: { path: 'src/components' },
}
flow: ['pages -> components']
```

## Test Scenarios

### Check Single Package by Path
```bash
archgate check --package packages/web-api
```

### Check Single Package by Name
```bash
archgate check --package @monorepo/web-api
```

### Check All Packages
```bash
archgate check --all
```

## Cross-Package Imports

The web app imports from workspace packages:
- `@monorepo/web-api` - API handlers
- `@monorepo/shared-utils` - Utility functions
- `@monorepo/ui-components` - UI components

These imports resolve through the tsconfig.json path mappings.

## Key Features Tested

1. **Workspace Detection**: Detects packages from `pnpm-workspace.yaml`
2. **Per-Package Configs**: Each package has its own `archgate.config.ts`
3. **Package Selection**: `--package` flag works with paths and names
4. **Bulk Checking**: `--all` flag checks all packages
5. **Cross-Package Resolution**: Path aliases resolve correctly

## Why This Matters

Monorepos are common in modern development:
- Shared packages (utils, components) reused across apps
- Each package may have different architectural needs
- Centralized enforcement with per-package flexibility
- Detects cross-package violations (package A importing internals from package B)
