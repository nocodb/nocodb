# NocoDB SDK (nocodb-sdk)

## What's Here

TypeScript types + auto-generated API client used by both backend and frontend.

```
nocodb-sdk/
├── src/
│   ├── lib/                 # CE types and utilities
│   │   ├── Api.ts           # AUTO-GENERATED from swagger — do NOT edit manually
│   │   ├── enums.ts         # AppEvents, filter operators, column types
│   │   ├── UITypes.ts       # UITypes enum (separate from enums.ts)
│   │   ├── globals.ts       # Global utilities and type enums
│   │   ├── columnHelper/    # Column type helpers
│   │   ├── filter/          # Filter logic
│   │   ├── formula/         # Formula parsing
│   │   ├── workflow/        # Workflow types
│   │   └── ...              # ~24 feature-based subdirectories
│   └── ee/                  # EE-only types (excluded from CE build)
│       └── lib/             # EE library (roleHelper-ee, workflow, teams, etc.)
└── build-script/            # SDK generation scripts
```

## IMPORTANT: Api.ts Is Auto-Generated

`Api.ts` is generated from swagger at `packages/nocodb/src/schema/swagger.json`.

Regeneration happens automatically as part of `pnpm run build:ee`. Add new types to files in `src/lib/` — NOT to `Api.ts` directly.

## Build Commands

```bash
pnpm run build         # CE build
pnpm run build:ee      # EE build (includes EE types from src/ee/)
```

## CE/EE Split

```
src/lib/               # CE types and utilities
src/ee/                # EE-only types (sibling to lib/, excluded from CE build)
```

## When to Modify

- Adding new types/interfaces → create in `src/lib/` or a feature subdirectory under it
- Adding new events → add to `AppEvents` enum in `src/lib/enums.ts`
- Adding API client methods → update swagger schema in backend, then regenerate SDK
- ALWAYS rebuild SDK after changes: `pnpm run build:ee`

## Payment Types

`src/lib/payment/index.ts` — shared enums/constants (CE + EE): `PlanTitles`, `PlanFeatureTypes`, `PlanLimitTypes`, upgrade message maps, `NON_SEAT_ROLES` (in `globals.ts`).

`src/ee/lib/payment/index.ts` — plan definitions for both Cloud and On-Prem.

### Plan Override Model

Cloud and On-Prem have **separate** plan definition objects. They are NOT inherited.

| Plan | Base default | Override style | Defined in |
|------|-------------|----------------|------------|
| **Cloud** (Free, Plus, Business, Enterprise) | All features **enabled** | List `false` to disable | `CloudPlanDefinitions` |
| **On-Prem Free** (unlicensed) | All features **disabled** | List `true` to enable | `OnPremPlanDefinitions[FREE]` |
| **On-Prem paid** (Starter, Scale, Enterprise) | All features **enabled** | List `false` to disable | `OnPremPlanDefinitions[*]` |

To make a feature available everywhere: remove the entry from Cloud plans (unlisted = enabled) and add explicit `true` in `OnPremPlanDefinitions[FREE]`.

`resolveOnPremPlanMeta(title)` computes the full meta: sets the base (all `false`/`0` for Free, all `true`/`-1` for paid), then applies plan-specific overrides.

## Anti-Patterns

These are SDK-specific — see root CLAUDE.md for universal anti-patterns.

| Don't | Do Instead |
|-------|-----------|
| Edit `Api.ts` manually | Modify swagger in backend, then `pnpm run build:ee` |
| Add EE-only types to `src/lib/` | Add to `src/ee/lib/` — CE build must work without them |
| Add shared EE/CE types to `src/ee/` | Add to `src/lib/` — types used by both must be in CE so CE build doesn't break |
| Skip `pnpm run build:ee` after changes | Always rebuild — backend/frontend will crash on missing exports |
