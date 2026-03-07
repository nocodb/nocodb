# NocoDB Backend (NestJS + Knex)

## Architecture

```
src/
├── controllers/          # CE REST endpoints (legacy pattern — see internal controllers)
├── controllers/internal/ # Internal controller system (new endpoints go here)
│   └── modules/          # UiGet.operations.ts, UiPost.operations.ts, etc.
├── services/             # Business logic (~170 CE services + EE overrides)
├── models/               # Database entities (~70 CE + ~40 EE models)
├── db/                   # Query layer — Knex.js (NOT an ORM), dynamic based on column metadata
├── helpers/              # Utilities (NcError, validatePayload, etc.)
├── guards/               # Auth guards (GlobalGuard, MetaApiLimiterGuard)
├── middlewares/           # extract-ids, global middleware
├── modules/              # NestJS modules (noco.module.ts is the main registration point)
├── ee/                   # Enterprise features (extends CE via class inheritance)
├── ee-cloud/             # Cloud-specific EE overrides
└── ee-on-prem/           # On-prem EE (license validation)
```

Multi-tenancy via `NcContext` parameter passed through all services.

## Deployment Modes

Three deployment modes with different backend builds. See root CLAUDE.md for the full overview.

### Build Targets

| Mode | Command | `~/` resolution | Entry point |
|------|---------|-----------------|-------------|
| **CE** | `pnpm watch:run:pg` | `src/*` | `src/run/docker.ts` |
| **EE (local dev)** | `pnpm watch:run:pg:ee` | `src/ee/*` → `src/*` | `src/ee/run/docker.ts` |
| **On-Prem** | `pnpm watch:run:pg:ee-on-prem` | `src/ee-on-prem/*` → `src/ee/*` → `src/*` | `src/ee/run/docker.ts` |
| **Cloud** | `pnpm watch:run:pg:ee-cloud` | `src/ee-cloud/*` → `src/ee/*` → `src/*` | `src/ee/run/docker.ts` |

`watch:run:pg:ee` is the **default for local development** — it runs the shared EE layer without license validation or cloud services. On-Prem and Cloud extend this base with their own overrides.

### Runtime Constants

Each tier exports constants selected by tsconfig path resolution at build time:

| Constant | CE (`src/utils/constants.ts`) | EE (`src/ee/utils/index.ts`) | On-Prem (`src/ee-on-prem/utils/index.ts`) | Cloud (`src/ee-cloud/utils/index.ts`) |
|----------|------|----|---------|----|
| `isEE` | `false` | `true` | `true` | `true` |
| `isOnPrem` | `false` | `false` | `true` | `false` |
| `isCloud` | `false` | `false` | `false` | `true` |

`Noco.isEE()` — runtime check used in `appInfo`. On-Prem overrides this based on license validation (`NocoLicense.isEE`).

### Feature Gating

| Mode | Mechanism |
|------|-----------|
| CE | EE code excluded from build — no runtime guard needed |
| On-Prem | `LicenseGuard` on EE endpoints; `Noco.isEE()` for runtime checks; `NocoLicense.init()` validates JWT + heartbeat |
| Cloud | `checkForFeature()` / `checkLimit()` from `ee/helpers/paymentHelpers.ts` — reads workspace plan |

### License (On-Prem only)

`src/ee-on-prem/NocoLicense.ts` — validates license JWT on startup, heartbeats every 24h, 30-day grace period for offline. License states: `active` (EE enabled), `expired`/`suspended`/`revoked`/none (falls back to CE mode). License key set via `NC_LICENSE_KEY` env var or stored in `nc_store` table (set via admin UI).

`Noco.loadEEState()` re-validates when license is changed at runtime (admin panel).

### EE Decorators

Two decorators gate EE functionality at different layers:

**`@EEOnly()`** — Service method decorator (`ee/decorators/ee-only.decorator.ts`). When licensed, runs the EE method. When unlicensed, transparently calls the CE parent class's version of the same method (or returns `undefined` if no CE equivalent). Eliminates manual `if (!isEE) return super.method()` boilerplate.

```ts
// ee/services/sorts.service.ts
@Injectable()
export class SortsService extends SortsServiceCE {
  @EEOnly()
  async sortCreate(context, param, ncMeta?) {
    // EE validation — skipped when unlicensed, falls back to CE
    return super.sortCreate(context, param, ncMeta);
  }
}
```

**`@License(feature)`** — Controller decorator (`ee/decorators/license.decorator.ts`). Attaches a `LicenseGuard` that returns HTTP 402 if no valid license. Special case: `@License('workspaces')` is allowed on unlicensed on-prem (workspaces are core). Can be applied at class or method level, stacks with `@Acl`.

```ts
@License('workspaces')
@Controller()
export class WorkspaceUsersController { ... }
```

| Decorator | Layer | Unlicensed behavior | Use for |
|-----------|-------|-------------------|---------|
| `@EEOnly()` | Service method | Falls back to CE parent | EE overrides that add validation on top of CE logic |
| `@License(feature)` | Controller endpoint | HTTP 402 | EE-only endpoints with no CE equivalent |

## Adding a New API Endpoint

Use the **internal controller pattern** — do NOT create direct controller files (legacy).

Each operations module implements `InternalApiModule`, declares its `operations` list, and routes via a `handle()` switch. Modules are registered in `controllers/internal/provider.ts` (CE) or `ee/controllers/internal/provider.ts` (EE).

**When to create a new module vs add to UiGet/UiPost:**
- Distinct feature with 3+ operations → create dedicated module (e.g., `McpGet.operations.ts`, `WorkflowPost.operations.ts`)
- Small addition to existing UI surface → add to `UiGet.operations.ts` or `UiPost.operations.ts`

Existing modules: `UiGet/UiPost` (catch-all), `McpGet/McpPost`, `OAuthGet/OAuthPost`, `DependencyPost`, `RecordAuditList`. EE adds: `WorkflowGet/WorkflowPost`, `ManagedAppGet/ManagedAppPost`, `IntegrationPost`, `SendRecordEmail`.

**Steps:**

1. Add operation scope → `src/controllers/internal/operationScopes.ts` (EE: `ee/controllers/internal/operationScopes.ts` which spreads CE)
2. Create or pick operations module → `src/controllers/internal/modules/{Feature}Get.operations.ts`
   - Implement `InternalApiModule<InternalGETResponseType>` (or `InternalPOSTResponseType`)
   - Declare `operations` array, `httpMethod`, and `handle()` switch
3. If new module: register in `src/controllers/internal/provider.ts` → `InternalApiModules` array
4. Create service → `src/services/{feature}.service.ts`
5. Create model → `src/models/{Feature}.ts`
6. Register ACL → BOTH `src/utils/acl.ts` AND `src/ee/utils/acl.ts` — every operation in `operationScopes` must have entries in `permissionScopes` AND `permissionDescriptions`
7. Register service → `src/modules/noco.module.ts` providers array
8. Add AppEvents + emit hooks (see [AppEvents / AppHooks](#appevents--apphooks) below)

## Adding a New Model/Entity

1. Create model class implementing the SDK type interface
2. Add `MetaTable` entry in BOTH `src/utils/globals.ts` AND `src/ee/utils/globals.ts`
3. Add `CacheScope` in BOTH CE and EE globals
4. Add nanoid prefix in BOTH `src/meta/meta.service.ts` AND `src/ee/meta/meta.service.ts`
5. Create migration in `src/meta/migrations/v0/` and register in `XcMigrationSourcev0.ts`

## Model Pattern

```typescript
import type { FeatureType } from 'nocodb-sdk';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

export default class Feature implements FeatureType {
  // Use static methods for CRUD: insert(), get(), list(), update(), delete()
  // All take optional `ncMeta = Noco.ncMeta` for testability
  // Use metaInsert2/metaGet2/metaList2/metaUpdate for database operations
}
```

Primary key scoping:
- **Base scope** (views, columns): composite PK `['base_id', 'id']` + `fk_workspace_id`
- **Workspace scope**: just `id` PK + `fk_workspace_id`
- **Org scope** (users, tokens): just `id` PK

## Cache Operations

```typescript
// IMPORTANT: appendToList() must come AFTER get() so parentKeys are set
await NocoCache.get(context, `${CacheScope.FEATURE}:${id}`, CacheGetType.TYPE_OBJECT);
await NocoCache.set(context, `${CacheScope.FEATURE}:${id}`, data);
await NocoCache.appendToList(context, CacheScope.FEATURE, [parentId], key);

// Delete — use CacheDelDirection, NOT CacheScope
await NocoCache.deepDel(context, key, CacheDelDirection.CHILD_TO_PARENT);
```

Common mistake: passing `CacheScope.*` instead of `CacheDelDirection.*` to `deepDel` — these are different enums.

## Migrations

All new migrations in `src/meta/migrations/v0/` — v1/v2/v3 are deprecated. **1 migration per PR max** — if schema evolves during the PR, update the same migration file.

```bash
# Find next migration number:
ls src/meta/migrations/v0/ | grep -E '^nc_[0-9]+' | sort | tail -1
```

Register in `XcMigrationSourcev0.ts`: add import, add to `getMigrations()`, add case to `getMigration()`.

Do NOT add idempotency guards (`hasTable`/`hasColumn`) — Knex tracks migration state, so they are unnecessary.

### Satellite Database Migrations

Tables whose size is driven by user input (unbounded growth + large payloads) are **satellite candidates** — they can be offloaded to a separate DB via env var (`NC_AUDIT_DB`, `NC_DOCS_DB`). Current satellites: `nc_audit`, `nc_doc_content`. Normal meta tables (columns, views, filters) are bounded and do NOT qualify.

Rules:
- **No `NocoCache`** — satellite data is too large/volatile to cache. Read/write directly via Knex.
- **Single source of truth** — schema lives in `migrations/{feature}/nc_001_init.ts`. Both the v0 migration and the satellite migration source import from it.

Reference implementation — docs content:

```
migrations/docs-content/nc_001_init.ts    ← canonical schema (up/down)
migrations/XcMigrationSourceDocsContent.ts ← references docs-content/, used by EE service
migrations/v0/nc_*_docs.ts                ← imports up/down from docs-content/
ee/meta/docs-content.service.ts           ← runs satellite source against NC_DOCS_DB
```

```typescript
// v0 migration — import, don't duplicate
import { up as createDocContent, down as dropDocContent } from '~/meta/migrations/docs-content/nc_001_init';

const up = async (knex: Knex) => {
  await createDocContent(knex);
};
```

Same pattern for audit (`audit/nc_001_init.ts`, `NC_AUDIT_DB`).

## AppEvents / AppHooks

Services emit typed events via `AppHooksService` for audit logging and side effects. When adding a new feature, you must wire up events across three files:

1. **SDK enum** → add events to `AppEvents` in `packages/nocodb-sdk/src/lib/enums.ts`, then rebuild SDK
2. **Event interfaces** → define typed payloads in `ee/services/app-hooks/interfaces.ts` extending `NcBaseEvent` (which requires `context: NcContext` and `req: NcRequest`)
3. **AppHooksService overloads** → add both `on()` and `emit()` typed overloads in `ee/services/app-hooks/app-hooks.service.ts`
4. **Service** → inject `AppHooksService` and call `this.appHooksService.emit(AppEvents.X, { context, req, ... })` after successful operations

```typescript
// Interface — always extends NcBaseEvent (provides context + req)
export interface FeatureCreateEvent extends NcBaseEvent {
  featureId: string;
}

// Emit — context is required, not optional
this.appHooksService.emit(AppEvents.FEATURE_CREATE, {
  context,        // NcContext — always include
  req: param.req, // NcRequest — always include
  featureId: feature.id,
});
```

Common mistake: forgetting `context` in the emit payload — `NcBaseEvent` requires it and TypeScript will error.

## Error Handling (NcError)

All errors go through `NcError` (`src/helpers/ncError.ts`). Never `throw new Error()` or expose `error.message` to users.

```typescript
import { NcError } from '~/helpers/ncError';

// With context (services, controllers, middleware) — version-aware (V1/V3)
const ncError = NcError.get(context);
ncError.dashboardNotFound(id);

// Without context (models, static helpers) — V1 default
NcError.integrationNotFound(id);
NcError.badRequest('Key is required');
```

**Priority** — use the most specific method available:

```
1. Scoped       →  ncError.dashboardNotFound(id)        // best — typed error code
2. Generic      →  ncError.genericNotFound('Widget', id) // no scoped method exists
3. Domain       →  ncError.invalidRequestBody(msg)      // validation failures
4. Fallback     →  ncError.badRequest(msg)              // last resort
```

Scoped methods exist for: `base`, `table`, `view`, `field`, `source`, `user`, `hook`, `integration`, `record`, `workspace`, `team`, `dashboard`, `widget`, `script`, `workflow`, `extension`. Use `genericNotFound(resource, id)` for new entities.

**Rules:**
- `NcError.get(context)` when context available, `NcError.static()` when not
- Most specific method first — `ncError.tableNotFound(id)` not `ncError.notFound('Table not found')`
- Never expose internals — `ncError.badRequest('Invalid input')` not `ncError.badRequest(error.message)`
- Guard early — validate at the top of service methods
- Log then throw — `this.logger.error(e.message, e.stack)` then `ncError.internalServerError('safe msg')`

## EE Extension Pattern

```typescript
// src/ee/services/feature.service.ts
import { FeatureService as FeatureServiceCE } from 'src/services/feature.service';

@Injectable()
export class FeatureService extends FeatureServiceCE {
  // Override or extend CE methods
}
```

Register EE services in `src/ee/modules/noco.module.ts`.

## Testing

### Unit Tests

Framework: **Mocha + Chai + Supertest** (NOT Jest). Uses `@swc-node/register` for TS compilation.

```bash
pnpm test:unit              # SQLite
pnpm test:unit:pg:ee        # PostgreSQL + EE
```

Test context uses 3-layer pattern: IInitContext → ITestContext → test-specific setup.
beforeEach helpers: `textBased`, `numberBased`, `selectBased`, `dateBased`, `linkBased`.

### API Testing (Live Backend)

After implementing or modifying API endpoints, delegate to the **`nc-api-verifier` agent**. It builds/updates a test script at `.claude/branches/{branch}/test.py` and runs it against the live backend.

1. Ensure backend is running in EE mode: `cd packages/nocodb && pnpm run watch:run:pg:ee`
2. Delegate to nc-api-verifier with a brief: which endpoints changed, which roles to test
3. nc-api-verifier reads the API code, creates/updates test.py, runs it, reports PASS/FAIL
4. Fix failures and re-delegate until all tests pass
5. Do NOT mark an API task as complete until tests pass

## Data Operations Layer

When working on data operations (CRUD, filtering, sorting, RLS, etc.), changes may need to touch multiple layers:

| Layer | Path | Description |
|-------|------|-------------|
| **BaseModel CE** | `src/db/BaseModelSqlv2.ts` | Core data access (~206KB), all CRUD operations |
| **BaseModel EE** | `ee/db/BaseModelSqlv2.ts` | EE override — license checks, RLS, audit enhancements |
| **Optimized read** | `ee/dbQueryClient/cross-db-utils/single-query-read.ts` | Single-query record fetch (bypasses N+1) |
| **Optimized list** | `ee/dbQueryClient/cross-db-utils/single-query-list.ts` | Single-query record list with pagination/filtering |
| **PG helpers** | `ee/services/data-opt/pg-helpers.ts` | PostgreSQL-specific optimized paths |
| **MySQL helpers** | `ee/services/data-opt/mysql-helpers.ts` | MySQL-specific optimized paths |
| **DataOpt service** | `ee/services/data-opt/data-opt.service.ts` | Routes operations to DB-specific helpers |

When modifying data operations, ensure changes are applied across all relevant layers — not just BaseModel.

## Payment (EE only)

Models: `Plan.ts` (meta = features+limits, `FreePlan` constant), `Subscription.ts` (`calculateWorkspaceSeatCount()`), `Workspace.ts` (adds `payment`, `stripe_customer_id`, `loyal`). Service: `src/ee/modules/payment/payment.service.ts` (Stripe checkout/subscriptions/webhooks/reseat/invoices). Controller: `/api/payment/` (ACL) + `/api/internal/payment/` (BasicAuth). Helpers: `paymentHelpers.ts` — `checkLimit()`, `checkForFeature()`, `checkSeatLimit()` — called from BaseModel, extract-ids middleware, job processors, view/filter models. ACL: `manageSubscription`, `paymentSeatCount` (owners only). Migrations: `nc_038`/`nc_039`/`nc_043`.

## Key Files

- `src/db/BaseModelSqlv2.ts` — Core data access layer (~206KB, handles all CRUD)
- `src/controllers/internal/operationScopes.ts` — All API operation registrations
- `src/utils/globals.ts` — MetaTable, CacheScope, CacheDelDirection enums
- `src/modules/noco.module.ts` — Main service registration
- `src/middlewares/extract-ids/extract-ids.middleware.ts` — ACL + permission extraction
- `src/meta/migrations/v0/` — All database migrations

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Server won't start / crashes on boot | Missing SDK exports (enum added but SDK not rebuilt) | `cd packages/nocodb-sdk && pnpm run build:ee`, then restart |
| `Cannot find module` for an EE service | Service not registered in `src/ee/modules/noco.module.ts` | Add to providers array |
| `MetaTable.X is undefined` at runtime | Added to CE `globals.ts` but not EE `globals.ts` | Add to `src/ee/utils/globals.ts` — EE completely overrides CE |
| API returns 403 unexpectedly | ACL not registered for the operation | Check BOTH `src/utils/acl.ts` AND `src/ee/utils/acl.ts` |
| Cache returns stale data | `appendToList()` called before `get()` | Ensure `get()` runs first so parentKeys are populated |
| Test IDs don't match after restart | Test script uses hardcoded IDs from a previous run | Re-fetch IDs at test start (authenticate fresh, query for entities) |
| Context lost between sessions | Branch memory not updated | Check `.claude/branches/{branch}/log.md` — if empty, session end protocol was skipped |

## Logging

Use NestJS `Logger` from `@nestjs/common` — never `console.log`/`console.error`.

```typescript
import { Logger } from '@nestjs/common';

protected logger = new Logger(MyService.name);
```

**`logger.error()` is NOT like `console.error()`** — the second parameter is a **stack trace string**, not a second message.

```typescript
// Correct
this.logger.error(e.message, e.stack);           // message + stack trace
this.logger.error('Error deleting base');         // message only

// Wrong — second arg is treated as stack trace, not a message
this.logger.error('Something failed', 'more info');     // 'more info' becomes stack
this.logger.error('Error', error);                      // Error object as stack — pass error.stack instead
this.logger.error('msg1', 'msg2');                      // msg2 is NOT a second message
```

## Anti-Patterns

These are backend-specific — see root CLAUDE.md for universal anti-patterns.

| Don't | Do Instead |
|-------|-----------|
| Run backend in CE mode for EE features | Use `pnpm run watch:run:pg:ee` — CE mode uses SQLite and lacks workspace support |
| Apply data operation changes only to BaseModel | Check all layers: BaseModel CE/EE, optimized paths, pg-helpers, mysql-helpers |
| Expose `error.message` to end users | Use `NcError.*` helpers — they sanitize messages |
| Bypass BaseModel with direct DB queries | Use model layer for all data access |
| `logger.error(msg, error)` | `logger.error(e.message, e.stack)` — second param is stack trace, not a message |
| `throw new Error('...')` | `NcError.get(context).specificMethod()` — always use NcError |
| Add `AppEvents` enum without wiring overloads | Add event interface in `interfaces.ts`, `on()` + `emit()` overloads in `app-hooks.service.ts`, include `context` in payload |
| Add operation to `operationScopes` but not ACL | Every operation needs entries in BOTH `permissionScopes` AND `permissionDescriptions` in `acl.ts` |
| Broadcast realtime base events without `base_id` in payload | Frontend relies on `payload.base_id` (table events) or `payload.table.base_id` (column events) to scope updates — missing it causes cross-base leaks |
