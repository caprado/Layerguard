# Unlayered Bypass Fixture

Tests detection of imports to files outside declared layers.

## The Problem

Without enforcement, files outside declared layers create a backdoor:
1. Put shared logic in `src/misc/helpers.ts` (not in any layer)
2. Every layer imports it
3. Layerguard says nothing - boundaries are silently bypassed

## Configuration

```typescript
rules: {
  unlayeredImports: 'error' // or 'warn' | 'ignore'
}
```

## Scenarios

### Violation (Layered → Unlayered)

`src/utils/index.ts` imports from `src/misc/helpers.ts`:
- utils is a declared layer ✓
- misc is NOT a declared layer ✗
- This is a violation with `unlayeredImports: 'error'`

### Valid Cases

1. **utils → lib** (both declared layers) ✓
2. **misc → utils** (unlayered importing layered) ✓
   - Unlayered files are not subject to rules
3. **misc → misc** (unlayered to unlayered) ✓

## Why This Matters

Prevents architecture erosion:
- Teams can't bypass rules by putting code outside layers
- Forces explicit decisions about layer structure
- Adoption-friendly: defaults to 'ignore' to avoid blocking migration

## Migration Strategy

1. Start with `unlayeredImports: 'ignore'` (default)
2. Gradually move code into declared layers
3. Switch to `unlayeredImports: 'warn'` to see what's left
4. Finally switch to `'error'` to enforce clean boundaries
