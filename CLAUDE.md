# NocoDB Enterprise (nocohub)

> This is `nocohub` (NocoDB Enterprise/Hub), NOT the open-source `nocodb` repo. All work is proprietary.

## Repository Structure

```
nocohub/
├── packages/
│   ├── nocodb-sdk/              # TypeScript types + auto-generated API client
│   ├── nocodb/                  # Backend (NestJS + Knex)
│   ├── nc-gui/                  # Frontend (Vue 3 + Nuxt 3)
│   ├── noco-integrations/       # 60+ SaaS integration packages
│   ├── nc-integration-scaffolder/ # Integration scaffolding tool
│   ├── nc-sql-executor/         # SQL execution engine
│   ├── nc-secret-mgr/           # Secret management
│   └── nc-knex-dialects/        # Custom Knex dialects
├── tests/
│   └── playwright/              # E2E tests (Playwright)
├── scripts/                     # Build + SDK generation scripts
├── docker-compose/              # Docker configurations
└── .claude/
    └── skills/                  # Claude skills (automations, sync, commando)
```

## Build Order

```
nocodb-sdk  →  nocodb (backend)  →  nc-gui (frontend)
   types        NestJS API :8080     Vue 3/Nuxt 3 :3000
```

Start with migration or SDK type changes when a feature needs them. If schema evolves during the PR, update the same migration file — **1 migration per PR max**.

After SDK changes, rebuild SDK before backend or frontend: `cd packages/nocodb-sdk && pnpm run build:ee`

## Commands

```bash
# Bootstrap
pnpm run bootstrap          # Full EE setup (installs deps + builds SDK + builds integrations)

# SDK (always rebuild after type changes)
cd packages/nocodb-sdk && pnpm run build:ee

# Backend
cd packages/nocodb && pnpm run watch:run:pg:ee     # EE dev with hot reload

# Frontend
cd packages/nc-gui && pnpm run dev:ee              # EE dev with hot reload

# Tests
cd packages/nocodb && pnpm test:unit               # Unit tests (Mocha + Chai, NOT Jest)
cd packages/nocodb && pnpm test:unit:pg:ee          # PostgreSQL + EE
cd tests/playwright && pnpm test                    # E2E (Playwright)
```

## CE/EE Separation

EE code lives in `ee/` subdirectories that mirror CE structure. This applies across all packages.

- EE extends CE through class inheritance — never the other way
- CE code must work standalone without EE code
- Never import from `ee/` in CE code
- Backend has three EE tiers: `ee/` (shared), `ee-cloud/` (cloud-specific), `ee-on-prem/` (on-prem-specific)

CRITICAL: EE `globals.ts` completely overrides CE — it does NOT inherit. When adding MetaTable/CacheScope entries in CE, you MUST also add them in `src/ee/utils/globals.ts` or values resolve to `undefined` at runtime.

## Type Safety Flow

1. Define types in `nocodb-sdk` first (in `src/lib/` — do NOT manually edit `Api.ts`, it's auto-generated from swagger)
2. Import types from `'nocodb-sdk'` in both backend and frontend
3. Backend validates against swagger schemas: `validatePayload('swagger.json#/components/schemas/Name', body)`
4. Never use `any` without justification

To regenerate SDK from swagger: `cd packages/nocodb-sdk && pnpm run build:ee`

## Import Aliases

- Backend: `~/` → `src/` (tsconfig alias), `src/` used for CE imports in EE files
- Frontend: `~/` or relative paths
- SDK types: always import from `'nocodb-sdk'`
- Do not use `~/ee/*` — `~/*` will automatically resolve based on edition

## Cross-Package Feature Checklist

When building features that span SDK → Backend → Frontend:

1. **SDK**: Add types to `src/lib/`, add events to `enums.ts`, rebuild with `pnpm run build:ee`
2. **Backend**: Create model + service, register in internal controllers + ACL + noco.module, create migration
3. **Frontend**: Create composable/store, build components, import types from `nocodb-sdk`
4. **Verify**: Run typechecks across all three packages

## Branch Memory

Claude maintains working memory in `.claude/branches/{branch}/` (gitignored) for every feature branch (not `develop`). This is maintained automatically — not just via `/commando`.

```
.claude/branches/{branch}/
├── index.md      # 10-second orientation: current focus, progress count
├── plan.md       # Phased task list with [S]/[M]/[L] sizing and checkboxes
├── context.md    # Why this feature exists, key decisions, discovery answers
├── log.md        # Reverse-chronological log of each session's work
└── test.py       # API test script (if applicable) — single self-contained file
```

On every session start on a non-develop branch, read `index.md` to orient. On every session end, update `log.md` with what was done.

## Design Decisions

For significant architectural or design decisions (not small implementation details):

1. Present 2-3 options with trade-offs before implementing
2. Wait for user direction — the user acts as architect
3. When the user points to existing code (e.g., "see commandPaletteHelpers.ts"), follow that pattern exactly
4. Don't add unnecessary abstractions — always check for existing patterns first

## PR Guidelines

- Follow existing patterns — consistency > cleverness
- Test across packages — changes often have cross-package impact
- Don't commit directly to `main` or `develop` without PR
- Don't skip SDK rebuild after type changes

## Anti-Patterns

| Don't | Do Instead |
|-------|-----------|
| Run backend in CE mode for EE features | Always use `pnpm run watch:run:pg:ee` unless explicitly asked for CE |
| Forget to rebuild SDK after enum/type changes | `cd packages/nocodb-sdk && pnpm run build:ee` after any SDK change |
| Cast with `as unknown` to work around type errors | Fix the type system properly (update the interface/type definition) |
| Create new abstractions when similar ones exist | Search for existing patterns first, ask if unsure |

## File Naming

- Backend operations module: `{Feature}Get.operations.ts` / `{Feature}Post.operations.ts`
- Backend services: `{feature}.service.ts`
- Backend models: `{Feature}.ts` (PascalCase)
- Backend migrations: `nc_{number}_{description}.ts`
- Frontend components: `{Feature}.vue` in appropriate `components/{category}/` directory
- Frontend composables: `use{Feature}.ts`
- Frontend stores: `{feature}.ts` in `store/`
