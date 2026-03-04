# Circular Dependencies Fixture

Tests detection of various circular dependency patterns.

## Test Cases

### 1. Simple Cycle (2 files)
```
a.ts → b.ts → a.ts
```

Files:
- `a.ts` imports from `b.ts`
- `b.ts` imports from `a.ts`

### 2. Indirect Cycle (3 files)
```
x.ts → y.ts → z.ts → x.ts
```

Files:
- `x.ts` imports from `y.ts`
- `y.ts` imports from `z.ts`
- `z.ts` imports from `x.ts`

### 3. Cross-Layer Consideration

`shared/helper.ts` imports from `modules/a.ts`:
- This is valid by flow rules (shared can import from modules)
- But it creates a potential cycle if modules also imports from shared
- This fixture doesn't include that violation, but shows the risk

### 4. Orphan Detection

`shared/orphan.ts` is not imported by any other file:
- Can be used to test orphan detection if enabled
- With `rules.orphans: 'warn'` or `'error'`, this would be flagged

## Expected Behavior

With `rules.circular: 'error'`:
- Both cycles should be detected
- Build should fail (exit code 1)
- Clear error messages showing the cycle path

## Why This Matters

Circular dependencies:
- Make code harder to understand and test
- Can cause issues with module loading order
- Often indicate architectural problems
