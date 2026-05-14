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
| On-Prem | Plan-aware `LicenseGuard` (`@License(PlanFeatureTypes.X)`) checks `OnPremPlanDefinitions` meta; `checkForFeature()` / `checkLimit()` in `ee-on-prem/helpers/paymentHelpers.ts` read `getOnPremPlan()`; `NocoLicense.init()` validates JWT + heartbeat |
| Cloud | `checkForFeature()` / `checkLimit()` from `ee/helpers/paymentHelpers.ts` — reads `workspace.payment.plan.meta` |

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

**`@License(PlanFeatureTypes.X)`** — Controller decorator (`ee/decorators/license.decorator.ts`). Takes a `PlanFeatureTypes` enum value directly. On on-prem, attaches a plan-aware `LicenseGuard` that checks `getOnPremPlan().meta[feature]` — returns HTTP 402 for unlicensed, HTTP 402 with plan upgrade message for licensed-but-wrong-tier. Use `PlanFeatureTypes.FEATURE_EE_CORE` for endpoints available on any paid plan (no per-tier restriction). Workspace controllers have no `@License` at all — workspaces are always core. Can be applied at class or method level, stacks with `@Acl`.

```ts
// Any paid plan (Starter+)
@License(PlanFeatureTypes.FEATURE_EE_CORE)
@Controller()
export class SnapshotController { ... }

// Specific plan feature
@License(PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT)
@Controller()
export class TeamsV3Controller { ... }
```

| Decorator | Layer | Unlicensed behavior | Use for |
|-----------|-------|-------------------|---------|
| `@EEOnly()` | Service method | Falls back to CE parent | EE overrides that add validation on top of CE logic |
| `@License(PlanFeatureTypes.X)` | Controller endpoint | HTTP 402 | EE-only endpoints gated by plan feature |

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

### Rebasing onto a newer base

When rebasing a feature branch onto an updated `develop`, **rename your migration file** if `develop` now contains migrations with a later timestamp than yours. The `nc_YYYYMMDDHHmm_*` prefix encodes ordering — a stale timestamp means the filename lies about run order, which is confusing and error-prone (developers grep by date, knex run-list and filename order should match).

Steps when you see a newer migration timestamp on `develop` post-rebase:

1. Pick a fresh timestamp later than the latest `develop` migration (use today's date)
2. `git mv src/meta/migrations/v0/nc_<old>_<title>.ts src/meta/migrations/v0/nc_<new>_<title>.ts`
3. Update all 4 references in `XcMigrationSourcev0.ts`: import binding name, import path, `getMigrations()` array entry, `getMigration()` switch case
4. Move all 4 references to come AFTER the newest existing entry — keep the file in chronological order

Migration order in `getMigrations()` is determined by the array, not the filename — but mismatched filenames are still a footgun. Fix it during the rebase, not after merge.

### Satellite Database Migrations

Tables whose size is driven by user input (unbounded growth + large payloads) are **satellite candidates** — they can be offloaded to a separate DB via env var (`NC_AUDIT_DB`, `NC_DOCS_DB`, `NC_CHAT_DB`, `NC_OP_LOG_DB`). Current satellites: `nc_audit`, `nc_doc_content`, `nc_chat_messages`, `nc_operation_logs`. Normal meta tables (columns, views, filters) are bounded and do NOT qualify.

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

## Command Registry

The command-registry is one subsystem driving **two** state-mutation flows from a single contract per operation:

- **Per-tab undo/redo** — `nc_operation_logs` rows, scoped to `(user, tab)`; dispatched by `UndoRedoService`.
- **Sandbox merge replay** — `nc_sandbox_changelog` rows; dispatched by `SandboxCommandReplayService` when a sandbox merges back into its production base.

Lives entirely in `src/ee/command-registry/`. Both flows resolve the same contract from `OperationRegistry`, run the same handler, and share the same replay scope (`runInReplay` → `isReplay()` true → `setReplay`/`getReplay` slots active).

### Architecture

```
                     ┌─ user mutation ──────────────────────────┐
                     │  @TraceCommand on service method         │
                     │     ↓ recordCommand()                    │
                     │  forward_params + inverse_params + meta  │
                     └────────────────┬─────────────────────────┘
                                      │
                  ┌───────────────────┴────────────────────┐
                  ▼                                        ▼
        nc_operation_logs                      nc_sandbox_changelog
        (per-tab undo/redo)                    (sandbox → prod merge)
                  │                                        │
                  ▼                                        ▼
         UndoRedoService                  SandboxCommandReplayService
                  └───────────────┬────────────────────────┘
                                  ▼
                     runInReplay → OperationRegistry.resolve(name, version)
                                  ▼
                     handler(ctx, params, meta)  ← same contract, same handler
```

The decorator writes both destinations from one call site. Replay (in either direction) sets `isReplay() = true` so model insert paths can honor pre-set ids and read `getReplay(...)` slots.

### Core types

| Type | File | Purpose |
|------|------|---------|
| `OperationContract<S, E, R>` | `src/command-registry/types.ts` | Versioned typed contract. `S` = zod schema, `E` = `meta.extra` shape, `R` = service result. Sections: `entry`, `undo`, `sandbox`. |
| `CommandHandler<C>` | `src/command-registry/types.ts` | `(ctx, params, meta) => Promise<unknown>` |
| `HandlerMeta` | `src/command-registry/types.ts` | `{ entryId, entityId?, originalReq, createdBy, extra? }` — `extra` is the persisted CaptureBag subset. |
| `CaptureBag` / `ReplayBag` | `src/command-registry/types.ts`, `src/{ee/,}helpers/replayScope.ts` | Typed slot dictionaries for side-effect ids — see "Side-effect ID preservation". |
| `OperationRegistry` | `src/ee/command-registry/registry.ts` | Singleton — `register`, `resolve`, `freeze`, `describe`. |

### File layout

```
src/ee/command-registry/
├── operations/{feature}.ts              # contracts + register{Feature}Handlers
├── operations/_schemas/{feature}.ts     # zod schemas (body + create/update/delete + capture)
├── bootstrap.ts                         # OperationRegistryBootstrap — registers + freezes
└── registry.ts, record.ts, replay-context.ts
src/command-registry/
├── types.ts                             # contract, CaptureBag, ParamsOf, etc.
└── op-names.ts                          # OperationName enum
```

Operation files use `~/command-registry/types` imports. Schemas live in their own files under `_schemas/` so contracts stay focused on entry/undo/sandbox wiring.

### Adding a new operation — end-to-end checklist

**1. Declare the zod schemas** — `src/ee/command-registry/operations/_schemas/{feature}.ts`

Schemas live in their own files under `_schemas/`, separate from contracts. Strict by default; the body schema is reused by both the create and the inverse-as-forward path.

```typescript
import { z } from 'zod';

const myFeatureBodySchema = z
  .object({
    /** Replay-injected — preserved across sandbox merge / undo→redo. */
    id: z.string().optional(),
    title: z.string(),
  })
  .strict();

export const myFeatureCreateSchema = z
  .object({
    baseId: z.string(),
    body: myFeatureBodySchema,
  })
  .strict();
```

**2. Declare the contract** — `src/ee/command-registry/operations/{feature}.ts`

`OperationContract<S, E, R>` carries three generics: `S` zod schema, `E` `meta.extra` shape, `R` service return type. Defaults to `<S, Record<string, any>, any>`. Set `E` and `R` explicitly when `entry.before` returns typed extras or when `undo.inverse` reads `result`.

The contract has three orthogonal sections — `entry` (what's recorded), `undo` (only for undoable ops), `sandbox` (only for ops that flow through sandbox replay).

```typescript
import type { OperationContract } from '~/command-registry/types';
import type { MyFeature } from '~/models';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { myFeatureActions } from '~/decorators/trace-command-descriptions';
import { myFeatureCreateSchema } from '~/command-registry/operations/_schemas/my-feature';

export const MyFeatureCreateContract: OperationContract<
  typeof myFeatureCreateSchema,
  Record<string, any>,
  MyFeature | undefined
> = {
  name: OperationName.myFeatureCreate,
  entity: MetaTable.MY_FEATURE,
  schema: myFeatureCreateSchema,
  entry: {
    entity_id: 'id',                      // path on the result, OR fn(params, result)
    entity_title: 'title',                // same
    parent_id: 'baseId',                  // path on params, OR fn
    description: myFeatureActions.add,    // DescFn from trace-command-descriptions.ts
    before: async (context, params) => {  // pre-state snapshot for undo / description / skip_if
      // return { entityTitle, parentEntityTitle, extra }
    },
  },
  sandbox: {
    id_field: 'body',                     // params[id_field].id is injected on replay
    // capture: ['mySideEffectKey'],      // see "Side-effect ID preservation"
    // dependencies: (params, result) => [{ entity, id }],
  },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.myFeatureDelete,
        params: { myFeatureId: result.id },
      };
    },
  },
};
```

**3. Register the handler** — same file, exported as `register{Feature}Handlers`

Default is `registerForward`. Switch to `OperationRegistry.register` only when you need to thread `meta` (replay-side captured ids).

```typescript
import { OperationRegistry } from '~/command-registry/registry';
import { registerForward } from '~/command-registry/replay-context';
import type { MyFeatureService } from '~/services/my-feature.service';

export function registerMyFeatureHandlers(svc: MyFeatureService): void {
  registerForward(MyFeatureCreateContract, (context, params) =>
    svc.create(context, params),
  );
}
```

**4. Decorate the service method**

`@TraceCommand` takes an `OperationName` enum value, NOT the contract object. CE has a no-op stub at `src/decorators/trace-command.decorator.ts`; EE has the real impl. Decorate the CE method (or EE override that adds real logic) — never write an EE override stub purely to attach the decorator.

```typescript
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';

@TraceCommand(OperationName.myFeatureCreate)
async create(context: NcContext, param: { baseId: string; body: ...; req: NcRequest }) {
  // ...
}
```

**5. Register in `OperationRegistryBootstrap`** — `src/ee/command-registry/bootstrap.ts`

- Inject the new service in the constructor.
- Call `registerMyFeatureHandlers(this.myFeatureSvc)` in `onApplicationBootstrap()`.

That's it — no other wiring needed.

### Replay pipeline

Both flows converge on the same registry call inside `runInReplay`:

**Sandbox merge** — `SandboxCommandReplayService.replayAll(sandboxBase, prodBase)`:
1. Loads all `nc_sandbox_changelog` entries ordered by `created_at`.
2. Builds a replay `NcContext` pointing at the production base via `buildReplayContext()`.
3. For each entry: `OperationRegistry.resolve(entry.name, entry.version)` → `{ contract, handler }`.
4. Calls `runInReplay(() => handler(replayCtx, entry.params, { entryId, entityId, originalReq, createdBy, extra: entry.extra }))`.

**Per-tab undo/redo** — `UndoRedoService.undo(...)` / `.redo(...)`:
1. Loads the latest active (undo) or undone (redo) `nc_operation_logs` row for `(user, tab)`.
2. Resolves the same way: `OperationRegistry.resolve(opName, opVersion)`.
3. Calls `runInReplay(() => handler(ctx, params, { ..., extra: entry.meta }))` with the inverse-direction params + op when undoing, forward-direction when redoing.
4. Marks the row `undone` (undo) or `active` (redo).

In both flows: the dispatcher pre-injects `entry.entity_id` into `params[contract.sandbox.id_field].id` so model insert paths preserve the original id (`metaInsert2` honors a pre-set `id` under `isReplay()`). Side-effect ids ride along via `meta.extra` → `setReplay`.

### `OperationRegistry.freeze()`

Called once in `OperationRegistryBootstrap.onApplicationBootstrap()` — after that, any `register()` call throws. This prevents late or accidental handler additions at runtime.

### Adding a new description function

Description helpers live in `src/ee/decorators/trace-command-descriptions.ts`. Each domain section returns a `DescFn` (imported from `src/command-registry/types`):

```typescript
export const myFeatureActions = {
  add: (ctx: DescCtx) => `Add ${ctx.entityTitle ?? 'item'}`,
  update: (ctx: DescCtx) => `Update ${ctx.entityTitle ?? 'item'}`,
  delete: (ctx: DescCtx) => `Delete ${ctx.entityTitle ?? 'item'}`,
};
```

### Decorate CE methods — don't write EE-only override stubs

Put `@TraceCommand(OperationName.x)` directly on the CE service method (CE has a no-op stub, EE has the real impl). Reach for an EE override only when EE adds real logic on top (sandbox guards, payment checks, license gating).

```typescript
// ❌ wrong — EE override that exists only to add the decorator
@Injectable()
export class GridsService extends GridsServiceCE {
  @TraceCommand(OperationName.gridViewCreate)
  async gridViewCreate(ctx, p) { return super.gridViewCreate(ctx, p); }
}
```

### Sandbox guards

Use one of three guards from `~/helpers/sandboxGuards` (CE stubs are no-ops; EE has real impl):

| Guard | Use before |
|-------|------------|
| `assertNotSandboxProduction(ctx, msg?)` | schema mutations on master that should flow through the sandbox |
| `assertNotSandbox(ctx, msg?)` | operations only valid on production (e.g. personal views) |
| `assertNotLockedViewOnSandboxProduction(ctx, viewId, msg?)` | view-update paths where locked views must be edited via the sandbox |

All three short-circuit when `isReplay()` returns true. Don't gate by `isEE` — the CE stub already no-ops.

### `isReplay()` — honor pre-set IDs at insert time

`runInReplay` opens an ALS scope used by both undo/redo dispatch and sandbox merge. Inside it, `isReplay()` returns true. The dispatcher pre-injects the original entity id into `params[contract.sandbox.id_field].id`. Insert paths must propagate that id:

```typescript
import { isReplay } from '~/helpers/replayScope';

// In a model / service insert (e.g. src/models/Hook.ts, src/ee/models/Script.ts):
if (isReplay() && entity.id) {
  insertObj.id = entity.id;
}
const row = await ncMeta.metaInsert2(/* … */, insertObj);
```

`metaInsert2` honors a pre-set `id`. Without this hook, the destination row gets a fresh nanoid and downstream FK references break across both undo/redo cycles and sandbox merges.

When adding a new replayable entity:
1. Set `sandbox.id_field` on the contract so the registry knows which params field to inject `entity.id` into.
2. Add the `isReplay() && entity.id` guard in the model / service insert path.
3. Extend `tests/unit/rest/tests/internal/ee/sandbox-id-preservation.test.ts` (`IdSnapshot` + `collectIds`) to assert the id survives the merge.

### `registerForward` vs custom handler

Default is `registerForward(Contract, (ctx, p) => svc.foo(ctx, p))`. Switch to `OperationRegistry.register(Contract, async (ctx, p, meta) => …)` when the handler needs to thread `meta`:

| Need | Use |
|------|-----|
| Recording side captured side-effect ids the replay needs (e.g. `rowColorFilterIds`, `viewSectionViewIds`) | `setReplay(key, meta.extra?.[key])` — service/model reads via `getReplay(key)`. See "Side-effect ID preservation" above. |
| Entity ID isn't in `params` (only carried as `meta.entityId`, e.g. `duplicateWidget`) | Pass through as a service-level `_replayXxxId` param. See `dashboards.handlers.ts:33`. |
| Deeply nested model code needs replay context but doesn't see params | Read via `getReplay` rather than threading through every call. |

### `skipIf` — conditionally suppress recording

Set `skipIf` on a contract when the operation is a no-op on replay (e.g. local override on an inherited entity). The decorator runs the body, then `skipIf(ctx, params, result, resolvedCtx)`, then writes the changelog row only if `skipIf` returns falsy. Reference: `BaseVariableUpdateContract` skips when `is_inherited === true` (`base-variables.operations.ts:75`).

### Re-entrancy is automatic — don't add manual flags

`@TraceCommand` uses `AsyncLocalStorage`; only the outermost decorated call in an async tree records. Nested calls (`tableDelete` → per-column `columnDelete`) auto-skip. Sequential siblings (importer calling `tableCreate` repeatedly) each record.

```typescript
// ❌ wrong — old pattern, removed
if (param.req?.__commandTraced) return originalMethod.apply(this, args);
(param.req as any).__commandTraced = true;
```

Never set re-entrancy flags on `req` or `param`. The ALS scope handles it.

### Side-effect ID preservation (CaptureBag / ReplayBag)

`sandbox.id_field` only covers the operation's primary entity. When a forward op also creates **hidden side-effect rows** (an inner filter tree, junction tables, default views, back-link columns), those ids must also survive across sandbox merge AND undo→redo. Without it the replay creates fresh ids and any later op targeting an original id silently no-ops.

The pattern is two paired typed bags:

- **`CaptureBag`** (`src/command-registry/types.ts`) — slots written by the forward path via `captureForTrace(key, value)`. The decorator persists them to `nc_operation_logs.meta` (and `nc_sandbox_changelog.extra`) for any contract that opts in via `sandbox.capture: [key]`.
- **`ReplayBag`** (`src/{ee/,}helpers/replayScope.ts`) — slots written by the replay handler via `setReplay(key, value)`, read by service / model code via `getReplay(key)`. Active only inside `runInReplay` (the dispatcher's outer scope).

End-to-end wiring for a new side-effect:

1. **Declare the slot type** on `CaptureBag` and `ReplayBag` (often the same shape — array of ids, or a map). Name them after the operation's domain (`rowColorFilterIds`, `viewSectionViewIds`).
2. **Forward path**: collect the ids the service produces, then `captureForTrace('myKey', ids)` once. Skip when `isReplay()` — replay is reading captured ids, not generating new ones.
3. **Contract**: add `sandbox.capture: ['myKey']` plus `capture_schema` (zod, strict) to validate before persistence. Schema lives in `_schemas/<feature>.ts`.
4. **Handler**: switch from `registerForward` to `OperationRegistry.register` so it can read `meta.extra`. Body is just `if (captured?.length) setReplay('myKey', captured)` then forward to the service. Same shape across the codebase — see `view-sections.ts:188-202` and `row-color.ts` for the rowColor variant.
5. **Service / model**: at the insert site, read `getReplay('myKey')` and use it. For tree-shaped data (e.g. nested filter children), assign ids in DFS pre-order at the entry of the service method so existing `isReplay() && entity.id` insert branches flow naturally.

Reference implementations: `viewSectionRestoreViewIds` (re-link child views on undo of a section delete), `rowColorFilterIds` (preserve inner filter ids across rowColorConditionAdd undo→redo), `sandboxColumnIds` / `sandboxDefaultViewId` (tableCreate side-effects).

LTAR is the **older variant** of the same idea — it still uses `param._ltarCapture` / `param._ltarReplayIds` carriers (filtered from the changelog params via `NON_SERIALIZABLE_KEYS`, surfaced via `extraCommandMeta` → `meta.extra.ltar`) plus `additionalContext.sandboxColumnIds` for `Column.bulkInsert`. Don't copy that shape for new code — use the typed bags above.

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

Models: `Plan.ts` (meta = features+limits; on-prem `FreePlan`/`buildOnPremPlan()` derived from `OnPremPlanDefinitions`), `Subscription.ts` (`calculateWorkspaceSeatCount()`), `Workspace.ts` (adds `payment`, `stripe_customer_id`, `loyal`). Service: `src/ee/modules/payment/payment.service.ts` (Stripe checkout/subscriptions/webhooks/reseat/invoices). Controller: `/api/payment/` (ACL) + `/api/internal/payment/` (BasicAuth). Helpers: `paymentHelpers.ts` — `checkLimit()`, `checkForFeature()`, `checkSeatLimit()` — on-prem version in `ee-on-prem/helpers/paymentHelpers.ts` reads `getOnPremPlan()` instead of workspace plan. ACL: `manageSubscription`, `paymentSeatCount` (owners only). Migrations: `nc_038`/`nc_039`/`nc_043`.

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
| Use inline `require()` instead of top-level `import` | Always use `import` at the top of the file — inline `require()` breaks type checking, tree-shaking, and is inconsistent with the codebase |
| Fetch user-supplied URLs without SSRF protection | Use `request-filtering-agent` (`useAgent(url)` for `httpAgent`/`httpsAgent`) to block private IPs and internal endpoints |
