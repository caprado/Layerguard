# Isolated Features Fixture

Tests sublayer isolation for feature-based architecture (Next.js style).

## Architecture

```
components/
├── features/
│   ├── auth/          # Isolated
│   ├── billing/       # Isolated  
│   └── dashboard/     # Isolated
└── shared/
    ├── ui/            # Shared components
    └── utils/         # Shared utilities
```

## Isolation Rules

With `isolated: true` on the `features` sublayer:

- ❌ auth → billing (violation)
- ❌ billing → dashboard (violation)
- ❌ dashboard → auth (violation)
- ✅ auth → shared (allowed by flow rules)
- ✅ shared → shared (same layer, always allowed)

## Violations

1. **billing/PaymentForm.ts** imports from `auth/LoginForm.ts`
   - Cross-feature import within isolated sublayer
   - Should extract shared code to `shared/`

2. **dashboard/DashboardWidget.ts** imports from `billing/PaymentForm.ts`
   - Another cross-feature import
   - Violates isolation boundary

## Valid Imports

- **auth/LoginForm.ts** imports from `shared/ui/Button.ts` ✓
- **auth/LoginForm.ts** imports from `shared/utils/format.ts` ✓

## Real-World Use Case

This pattern prevents:
- Feature coupling
- "Spaghetti imports" between unrelated features
- Accidental dependencies

Common in:
- Next.js App Router projects
- Feature-Sliced Design (FSD)
- Domain-Driven Design implementations
