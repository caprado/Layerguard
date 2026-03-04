# Barrel Exports Fixture

Tests the "import-site" enforcement policy for barrel files.

## Import-Site Policy

When file A imports from `services/index.ts`, the checked edge is:
- **A → services** (the layer containing the barrel file)

NOT:
- **A → repository** (where the symbol actually came from, if re-exported)

## Test Cases

### Valid Imports (No Violations)

1. **api/handlers.ts** imports from `../services/index.js`
   - Counts as api → services ✓
   - Even though services/index.ts re-exports repository code

### Invalid Imports (Violations)

1. **api/badHandler.ts** imports from `../repository/index.js`
   - Counts as api → repository ✗
   - This violates the flow rule (only api → services is allowed)

## Why This Matters

The consumer imported from the public API of `services`. That's the boundary they see and respect. If services internally re-exports from repository, that's an internal concern of the services layer.

## Alternative: Origin-Edge Policy (v2.3)

With `barrelResolution: 'origin'`, the edge would be traced to the original file:
- services/index.ts re-exports from repository/users.ts
- Edge becomes: api → repository (violation)

This is stricter but can produce surprising results.
