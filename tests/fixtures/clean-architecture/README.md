# Clean Architecture Fixture

A classic 3-layer architecture demonstrating proper dependency flow.

## Architecture

```
handlers → services → repository
```

## Layers

- **handlers**: HTTP request handlers / controllers (top layer)
- **services**: Business logic layer (middle layer)
- **repository**: Data access layer (bottom layer)

## Expected Violations

1. **handlers/userHandlers.ts** imports from `repository` directly (line 3)
   - Should only import from `services`
   - This violates the rule that handlers → repository is not allowed

## Valid Flows

- handlers → services ✓
- services → repository ✓

## Key Points

This fixture tests:
- Basic layer boundary enforcement
- Import resolution across multiple files
- Violation detection with correct line numbers
- Same-layer imports (repository → repository) are allowed
