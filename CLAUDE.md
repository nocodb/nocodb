# NocoDB Enterprise (nocohub)

> This is `nocohub` (NocoDB Enterprise/Hub), NOT the open-source `nocodb` repo. All work is proprietary.

## Session Start

If on a non-`develop` branch and `.claude/branches/{branch}/index.md` exists, **read it FIRST** before doing anything else. It tells you what this branch is about, current progress, and what to read next.

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
    └── skills/                  # Claude skills (automations, sync, nc-pr)
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

Claude maintains working memory in `.claude/branches/{branch}/` (gitignored) for every feature branch (not `develop`). This is maintained automatically — not just via `/nc-pr`.

```
.claude/branches/{branch}/
├── index.md      # 10-second orientation: current focus, progress count
├── plan.md       # Phased task list with [S]/[M]/[L] sizing and checkboxes
├── context.md    # Why this feature exists, key decisions, discovery answers
├── log.md        # Reverse-chronological log of each session's work
└── test.py       # API test script (if applicable) — single self-contained file
```

### Maintenance Protocol

On **every session**, regardless of whether `/nc-pr` was used:

- **Session start**: Read `index.md` to orient. If it doesn't exist, offer to set up branch memory.
- **After completing a task**: Check it off directly in `plan.md` (`- [ ]` → `- [x]`). One Edit call, no delegation.
- **Session end**: Delegate to `nc-memory` agent — it writes the log entry, updates progress count in index.md, and catches any missed plan.md updates.

### Log Entry Format

Each entry in `log.md` uses this structure:

```markdown
## {YYYY-MM-DD HH:MM} — {Type}: {Title}
{Details}
```

Entry types:

| Type | When |
|------|------|
| `action` | Code written, file created, commit made |
| `decision` | Non-obvious choice — include options considered + rationale |
| `investigation` | Explored something — findings, even dead ends |
| `blocker` | Something is stuck — what, why, possible unblocks |
| `resolved` | A blocker was cleared |
| `scope-change` | Plan was updated — what changed and why |

## Payment / Billing System

Stripe per-seat SaaS billing. **EE-only** — CE has zero payment awareness. No `NC_STRIPE_SECRET_KEY` = legacy unlimited plan.

- **Plans** → `PlanFeatureTypes` (boolean flags) + `PlanLimitTypes` (numeric limits) in `meta` field
- **Subscriptions** → link workspace/org to plan with Stripe state
- **`Workspace.payment`** → eagerly loaded on every fetch (plan + subscription)
- **Feature gating** → backend: `checkLimit()`/`checkForFeature()` in `paymentHelpers.ts`; frontend: `useEeConfig` `block*` computeds
- **Seat counting** → `NON_SEAT_ROLES` (viewer, commenter) are free. Reseat batched 10-min debounce for increases, immediate for decreases

Key files: SDK `src/lib/payment/index.ts` · Backend `src/ee/models/Plan.ts`, `Subscription.ts` · `src/ee/modules/payment/payment.service.ts` · `src/ee/helpers/paymentHelpers.ts` · Frontend `ee/composables/useEeConfig.ts`, `usePayment.ts` · `ee/components/payment/`

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
| Cast with `as unknown` or `as any` to work around type errors | Fix the type system properly (update the interface/type definition) |
| Create new abstractions when similar ones exist | Search for existing patterns first, ask if unsure |
| Use `console.log` / `console.error` in production code | Use `Logger` (backend) or remove (frontend) |
| Add `TODO` without a linked issue | Include issue reference or remove before PR |

## Frontend Patterns

### i18n (Internationalization)

Translation keys live in `packages/nc-gui/lang/en.json`. **Always reuse an existing key if it matches — only add a new one if no suitable key exists.**

#### Usage

**Inside `<script setup>` or Vue composables:**
```ts
const { t } = useI18n()
t('general.cancel')
```

**In `<template>`:**
```html
{{ $t('general.cancel') }}
```

**Outside `<script setup>` (utilities, non-setup composables):**
```ts
import { getI18n } from '~/plugins/a.i18n'

const { t } = getI18n().global
```

#### Key Structure

Keys are nested under top-level semantic groups. Add new keys to the most appropriate group:

| Group | Purpose |
|-------|---------|
| `general` | Common words: Save, Cancel, Delete, Loading… |
| `title` | Page / section headings |
| `labels` | Field labels, form labels |
| `objects` | Nouns: user, table, view, field… |
| `placeholder` | Input placeholder text |
| `tooltip` | Tooltip copy |
| `msg` | Success / error / info messages |
| `activity` | Activity feed strings |
| `upgrade` | Upgrade / upsell prompts |

Keys can be nested as deeply as needed:
```json
"labels": {
  "auth": {
    "signIn": "Sign in"
  }
}
```
Used as: `t('labels.auth.signIn')`

#### Interpolation (dynamic values)

Use `{varName}` placeholders in the JSON value, then pass an object as the second argument:

```json
"currentlyOnVersion": "Currently on {version}",
"signInWithProvider": "Sign in with {provider}",
"userIdColon": "USER ID: {userId}"
```

```ts
// script
t('msg.currentlyOnVersion', { version: '1.2.3' })

// template
$t('labels.signInWithProvider', { provider: 'Google' })
```

#### Things to watch out for

- **Never hardcode user-visible strings** — always go through `t()` / `$t()`.
- **Don't duplicate keys** — search `en.json` before adding a new one.
- **Pluralisation** — vue-i18n supports `{count} item | {count} items` syntax if needed.
- **`en.json` is the source of truth** — other locale files are translations of it; only edit `en.json` in PRs.

## File Naming

- Backend operations module: `{Feature}Get.operations.ts` / `{Feature}Post.operations.ts`
- Backend services: `{feature}.service.ts`
- Backend models: `{Feature}.ts` (PascalCase)
- Backend migrations: `nc_{number}_{description}.ts`
- Frontend components: `{Feature}.vue` in appropriate `components/{category}/` directory
- Frontend composables: `use{Feature}.ts`
- Frontend stores: `{feature}.ts` in `store/`
