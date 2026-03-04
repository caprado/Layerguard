# Windows Path Handling Fixture

Tests cross-platform path normalization for Windows-style backslash paths.

## The Problem

On Windows, paths often use backslashes (`\`), while Unix uses forward slashes (`/`).
If Archgate doesn't normalize these, layer matching can fail.

## Test Configuration

```typescript
layers: {
  utils: { path: 'src\\utils' },  // Windows backslash
  lib: { path: 'src/lib' },       // Unix forward slash
}
```

## Expected Behavior

Regardless of path separator:
- `src/utils/helper.ts` should match `utils` layer
- `src/lib/index.ts` should match `lib` layer
- Mixed separators in config should work

## Violations

1. **utils/badImport.ts** imports from `lib`
   - Violates flow rule (only lib -> utils allowed)
   - Should be caught regardless of path separator used in config

## Key Tests

- Path normalization on config load
- File matching with different separators
- Cross-platform compatibility
- Windows CI/CD compatibility

## Real-World Impact

Without proper normalization:
- Windows developers get different results than Mac/Linux
- CI/CD on Windows runners fails
- Mixed teams have inconsistent enforcement
