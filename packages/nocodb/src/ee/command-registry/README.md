# Command Registry

The command-registry is the spine of NocoDB's **state-mutation tracing** system. Every traced service-method call flows through it and lands in one or both of two persistent stores:

- **`nc_operation_logs`** — per-tab undo / redo stack.
- **`nc_sandbox_changelog`** — sandbox → production replay log (when the call is on a sandbox base).

Both stores hold the same shape (op name, params, captured side-effect ids). Both are replayed by the same `OperationRegistry.resolve(name, version) → { contract, handler }` lookup. The decorator writes to both from one site; **all three replay paths (sandbox merge, per-tab undo/redo, macro children) re-execute through one shared `dispatchOperation` helper** so their semantics are 1:1.

```
                ┌─ user mutation ──────────────────────────┐
                │  @TraceCommand on service method         │
                │     ↓ recordCommand()                    │
                │  forward_params + inverse_params + meta  │
                └────────────────┬─────────────────────────┘
                                 │
              ┌──────────────────┴────────────────────┐
              ▼                                        ▼
    nc_operation_logs                      nc_sandbox_changelog
    (per-tab undo/redo)                    (sandbox → prod merge)
              │                                        │
              ▼                                        ▼
     UndoRedoService                  SandboxCommandReplayService
              └─────────────────┬───────────────────────┘
                                │           ┌─ dispatchTranscriptEntry
                                │           │  (macro children, called from
                                │           │   inside a macro's replay handler)
                                ▼           ▼
                  OperationRegistry.resolve(name, version)
                                ▼
                  dispatchOperation(ctx, contract, handler, call)
                                ▼
                  runInReplay → handler(ctx, replayParams, meta)
```

## Vocabulary

| Term | Meaning |
|---|---|
| **Operation** | A single state-mutating service method (e.g. `columnAdd`, `viewUpdate`). Identified by `OperationName` enum + integer `version`. |
| **Contract** (`OperationContract`) | The declarative metadata for an operation: schema, undo inverse, sandbox capture allowlist, entity-id resolution. Lives in `operations/<feature>.ts`. |
| **Handler** | The `(ctx, params, meta) => Promise<R>` callback that re-executes a contract during replay. Registered alongside the contract in the same file. |
| **Forward params** | The validated input that drove the original user mutation. Persisted on the changelog row; replayed verbatim. |
| **Inverse op** | The op that undoes the forward op. Built at record time from `contract.undo.inverse(...)`. Persisted alongside the forward as `inverse_op` + `inverse_params`. |
| **Capture / CaptureBag** | Side-effect ids the forward run produces (LTAR junction id, filter ids, type-change backup ref, etc.). Captured via `captureForTrace(key, value)` and persisted on `meta.extra` for replay-side reuse. |
| **Replay** | The act of re-running a contract's handler from a persisted row. `isReplay()` returns true inside replay; insert paths honour pre-set ids and trash-restore short-circuits fire. |
| **Macro** | A user-facing op that fans out to N traced child ops (`columnsBulk`, `duplicateTable` etc.). Records as one log row carrying a transcript of children. |

## Layout

```
src/command-registry/                       (CE)
├── op-names.ts                              # OperationName enum
└── types.ts                                 # OperationContract, CaptureBag, MacroTranscriptEntry, ...

src/ee/command-registry/                    (EE — heavy lifting)
├── README.md                                ← this file
├── bootstrap.ts                             # OperationRegistryBootstrap module
├── record.ts                                # recordCommand (single write site)
├── registry.ts                              # OperationRegistry singleton (register / resolve / freeze)
├── replay-context.ts                        # dispatchOperation / makeReplayReq / registerForward / registerMacro / dispatchTranscriptEntry
└── operations/
    ├── _schemas/<feature>.ts                # zod schemas — strict, no `z.any`
    ├── shared/                              # cross-feature helpers (filter snapshot, view-replay-conflict)
    ├── macro.ts                             # macroUndo primitive
    └── <feature>.ts                         # contracts + register<Feature>Handlers
```

The decorator (`src/ee/decorators/trace-command.decorator.ts`) and replay-scope (`src/ee/helpers/replayScope.ts`) are sibling files this folder depends on.

## Authoring a new traced operation

A complete walkthrough — from "I want to record `myFeatureCreate`" to a working undo/redo + sandbox merge.

### 1. Add the name to the enum

`src/command-registry/op-names.ts`:

```ts
export const OperationName = {
  // ...
  myFeatureCreate: 'myFeatureCreate',
} as const;
```

### 2. Declare the schema

Strict zod. Drives both validation at write time and replay time.

`src/ee/command-registry/operations/_schemas/my-feature.ts`:

```ts
import { z } from 'zod';

const myFeatureBodySchema = z
  .object({
    /** Replay-time injection — the dispatcher writes the original id here. */
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

No `z.any`, no `passthrough()`. If the SDK type allows extra fields, list them; otherwise the schema rejects unknown keys. This is the only invariant `recordCommand` and `dispatchTranscriptEntry` enforce on persisted params.

### 3. Declare the contract

`src/ee/command-registry/operations/my-feature.ts`:

```ts
import type { OperationContract } from '~/command-registry/types';
import type { MyFeatureService } from '~/services/my-feature.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { registerForward } from '~/command-registry/replay-context';
import { MetaTable } from '~/utils/globals';
import { myFeatureActions } from '~/decorators/trace-command-descriptions';
import { myFeatureCreateSchema } from '~/command-registry/operations/_schemas/my-feature';

export const MyFeatureCreateContract: OperationContract<
  typeof myFeatureCreateSchema,
  Record<string, any>,            // E — entry.before's `extra` shape
  { id: string } | undefined      // R — service return type
> = {
  name: OperationName.myFeatureCreate,
  entity: MetaTable.MY_FEATURE,
  schema: myFeatureCreateSchema,
  entry: {
    entity_id: 'id',                          // path on result, OR fn(params, result)
    entity_title: (params) => params.body?.title,
    parent_id: 'baseId',                      // path on params
    description: myFeatureActions.add,
  },
  sandbox: {
    /** Replay dispatcher writes `entry.entity_id` into `params[id_field].id`
     *  so model insert paths can reuse the original id. */
    id_field: 'body',
  },
  undo: {
    inverse: (_ctx, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.myFeatureDelete,
        params: { myFeatureId: result.id },
      };
    },
  },
};

export function registerMyFeatureHandlers(svc: MyFeatureService): void {
  registerForward(MyFeatureCreateContract, (ctx, params) =>
    svc.create(ctx, params),
  );
}
```

`registerForward` is the default. Switch to `OperationRegistry.register(contract, handler)` when the handler needs to read `meta.extra` (captured side-effect ids) before forwarding.

### 4. Decorate the service method

`@TraceCommand` takes the **enum value**, not the contract object.

```ts
@Injectable()
export class MyFeatureService {
  @TraceCommand(OperationName.myFeatureCreate)
  async create(ctx: NcContext, param: { baseId: string; body: ...; req: NcRequest }) {
    // ...
  }
}
```

Decorate the **CE** method when possible (CE has a no-op stub of the decorator; EE has the real impl). Reach for an EE override only when EE adds real logic.

### 5. Wire into the bootstrap

`src/ee/command-registry/bootstrap.ts`:

```ts
import { registerMyFeatureHandlers } from '~/command-registry/operations/my-feature';
// ...
onApplicationBootstrap(): void {
  // ...
  registerMyFeatureHandlers(this.myFeatureSvc);
  OperationRegistry.freeze();
}
```

That's it. Five files, ~30 lines of new code beyond the schema, and your op records to `nc_operation_logs` + `nc_sandbox_changelog`, replays through both flows, and round-trips ids.

## How a forward call records

```
service method called
  ↓
@TraceCommand intercepts
  ↓
opens trace ALS scope
  ↓
runs contract.entry.before(ctx, params)                  ← snapshots pre-state into resolvedCtx.extra
  ↓
runs original method body
  ↓                                                       (during this step, model code may
                                                          captureForTrace('ltar', ...) etc. —
                                                          writes to scope's capture Map)
  ↓
runs contract.entry.skip_if(...)                         ← short-circuits no-op recording
  ↓
recordCommand(ctx, contract, params, result, resolvedCtx)
  │
  ├── extracts replayable params (filters NON_SERIALIZABLE_KEYS like req, ncMeta)
  ├── parses against contract.schema
  ├── reads contract.sandbox.capture allowlist + scope's capture Map → builds meta.extra
  ├── calls contract.undo.inverse(...) → builds inverse_op + inverse_params
  ├── parallel write:
  │     ├── nc_sandbox_changelog (if on a sandbox base)
  │     └── nc_operation_logs    (if undoable + req has x-nc-tab-id header + !isReplay)
  ↓
returns result to caller
```

## How a replay re-executes

Each replay path resolves the row → contract → handler, then funnels through `dispatchOperation` (in `replay-context.ts`) so the cross-tier transformations stay identical:

```
UndoRedoService.undo / .redo
SandboxCommandReplayService.replayCommand
dispatchTranscriptEntry  (macro child, from inside a macro's replay handler)
  ↓
OperationRegistry.resolve(opName, version) → { contract, handler }
  ↓
dispatchOperation(ctx, contract, handler, {
  params, entityId, extra, entryId, createdBy, originalReq
}):
  ├── req = makeReplayReq(originalReq, createdBy)
  ├── replayParams = { ...params, user: req.user, req }
  ├── if (replayParams.baseId) replayParams.baseId = ctx.base_id   ← sandbox→prod rewrite
  │                                                                  (no-op for undo/redo)
  ├── if (contract.sandbox.id_field && entityId)                   ← model inserts honor
  │     replayParams[id_field].id = entityId                          original id
  └── runInReplay(() =>                                            ← isReplay() true inside
        handler(ctx, replayParams, {
          entryId, entityId,    ← entityId drives trash-restore short-circuits
          originalReq, createdBy,
          extra,                ← LTAR / filter / backup ids land in setReplay slots
        })
      )
  ↓
inside handler, before calling svc.method:
  setReplay('ltarReplayIds', meta.extra?.ltar)
  setReplay('replayBackup',  meta.extra?.backup)
  ...
  ↓
svc.method runs with isReplay() === true:
  - inserts honor pre-set id (`metaInsert2` accepts pre-set id under isReplay)
  - LTAR fan-out reads getReplay('ltarReplayIds')
  - column update accepts forceUpdateSystem
  - etc.
```

If you change the replay contract (param transformation, scope wrapping, meta shape), change `dispatchOperation` once. No call site can drift independently.

## Side-effect id preservation

`sandbox.id_field` only covers the operation's primary entity. Many operations also create **hidden side-effect rows** that need stable ids across replay (otherwise an inverse op targeting the original id silently no-ops on a row that no longer exists).

The pattern is two paired typed bags:

| Bag | Where written | Where read | When |
|---|---|---|---|
| **`CaptureBag`** (`types.ts`) | `captureForTrace(key, value)` in service / model code | `recordCommand` (writes to `meta.extra`) | Forward run — collects what to persist |
| **`ReplayBag`** (`replayScope.ts`) | `setReplay(key, value)` in registered handlers | `getReplay(key)` deep in service / model code | Replay run — feeds captured ids into insert paths |

Both are typed by their respective key unions. New side-effect kind:

1. Add a slot on `CaptureBag` (in `types.ts`).
2. Add a corresponding slot on `ReplayBag` (in `helpers/replayScope.ts`).
3. Forward path: when the side-effect is generated, call `captureForTrace('myKey', value)`. Skip when `isReplay()` (replay is reading captured ids, not creating fresh ones).
4. Contract: opt into persistence via `sandbox.capture: ['myKey']`.
5. Handler: switch from `registerForward` to `OperationRegistry.register` so it can read `meta.extra`. Body becomes:
   ```ts
   if (meta.extra?.myKey) setReplay('myKey', meta.extra.myKey);
   return svc.foo(ctx, params);
   ```
6. Service / model: at the insert site, read `getReplay('myKey')` and use it.

Reference implementations:
- `viewSectionViewIds` — re-link child views when a section is recreated on undo.
- `rowColorFilterIds` — preserve inner filter ids across `rowColorConditionAdd` undo→redo (DFS pre-order cursor walk).
- `sandboxColumns` / `sandboxDefaultViewId` — `tableCreate`'s system-column + default-view ids.

## Macro operations

A **macro** is a user-facing op that fans out to multiple traced child ops. Examples:
- `columnsBulk` — multi-field editor save (N column adds/updates/deletes + M visibility toggles in one bundle).
- `duplicateTable` (planned) — clone a table including its columns, views, sorts, filters.
- `duplicateDashboard` (planned) — clone a dashboard plus its widgets and filters.
- Airtable import (planned) — N base / table / column / view / record creates.

The non-macro alternative is for each child to record its own log row. That breaks **single-Cmd-Z-reverts-the-whole-action** UX.

### How macros work

A contract opts in by setting `macro: true`:

```ts
export const ColumnsBulkContract: OperationContract<...> = {
  name: OperationName.columnsBulk,
  entity: MetaTable.MODELS,
  schema: columnsBulkSchema,
  macro: true,                         // ← opts into macro mode
  entry: { /* ... */ },
  undo: {
    inverse: (_ctx, _params, _result, resolved) => {
      const transcript = (resolved?.extra as { macroTranscript?: ... })?.macroTranscript;
      if (!transcript?.length) return null;
      return { name: OperationName.macroUndo, params: { transcript } };
    },
  },
};
```

When the macro-decorated method runs:

1. Outermost `@TraceCommand` opens a trace scope WITH a `transcript: []` array.
2. The service body just calls existing decorated child methods normally — `await this.columnAdd(...)`, `await this.viewColumnsService.columnUpdate(...)`, etc.
3. Each child's `@TraceCommand` sees the outer scope has `transcript` and **auto-instruments**:
   - Opens its own child capture scope (so `captureForTrace` writes don't collide between siblings).
   - Runs the child's `entry.before` to snapshot pre-state (`resolvedCtx`).
   - Runs the child method.
   - Harvests the bag (filtered by child's `sandbox.capture` allowlist) into `entry.extra`.
   - Records `resolvedCtx.extra` as `entry.resolvedExtra` (for the inverse builder).
   - Resolves `entityId` via the child contract's `entry.entity_id`.
   - Pushes one `MacroTranscriptEntry` to the outer transcript.
   - **Does NOT** call `recordCommand` for the child — only the outer macro records.
4. After the body, the decorator copies the transcript into both:
   - the capture map (`captureForTrace('macroTranscript', ...)`) → persisted on `meta.extra`.
   - `resolvedCtx.extra.macroTranscript` → readable by the macro's `undo.inverse`.
5. `recordCommand` writes one log row with the full transcript in `meta.extra.macroTranscript`.

### Macro replay

`registerMacro(contract, forwardCall)` wires forward-vs-replay routing:

```ts
registerMacro(ColumnsBulkContract, (ctx, params, req) =>
  svc.columnsBulk(ctx, { ...params, req }),
);
```

The wrapper checks `isReplay() && meta.extra?.macroTranscript`:
- **Forward** (`isReplay()` false): runs `forwardCall` (the service body fans out and auto-records).
- **Replay** (`isReplay()` true with transcript): walks the transcript and dispatches each entry via `dispatchTranscriptEntry`, which calls the same `dispatchOperation` helper used by `SandboxCommandReplayService` and `UndoRedoService`. Macro children get id_field injection, baseId rewrite, and a fresh `runInReplay` scope just like top-level replays — the only differences are an additional `schema.parse` (drift guard) and per-child error tolerance (`logger.warn` + continue, instead of bubbling).

### Macro inverse: `macroUndo`

Macros whose children require **heterogeneous** inverses (e.g. `columnsBulk`'s mix of `columnDelete`/`columnUpdate`/`trashRestore`) point their `undo.inverse` at `macroUndo`:

```ts
return { name: OperationName.macroUndo, params: { transcript } };
```

`macroUndo`'s registered handler walks the transcript **in reverse** and, for each entry, calls the child contract's own `undo.inverse(ctx, params, undefined, { extra: resolvedExtra })` to build that child's inverse op, then dispatches it via `dispatchTranscriptEntry`. Reuses every existing child inverse builder unchanged.

For macros whose inverse is naturally cascading (e.g. `duplicateTable` → `tableDelete` cascades; the trash restore brings back columns/views/sorts/filters intact), wire `undo.inverse` directly to that single op and skip `macroUndo`.

### Persisted shape

```jsonc
// nc_operation_logs row meta column for a duplicate-table macro
{
  "extra": {
    "macroTranscript": [
      {
        "op": "tableCreate",
        "version": 1,
        "params": { "baseId": "p_xyz", "table": { "title": "Tasks copy", ... } },
        "extra": {
          "sandboxColumns": [{ "id": "col_id_001", "title": "Id", "cn": "id" }, ...],
          "sandboxDefaultViewId": "vw_abc_001"
        },
        "entityId": "mdl_tasks_002"
      },
      {
        "op": "columnAdd",
        "version": 1,
        "params": { "tableId": "mdl_tasks_002", "column": { "title": "Owner", "uidt": "LinkToAnotherRecord", ... } },
        "extra": {
          "ltar": { "mm": "mdl_users_tasks_001", "fk1": "...", "linkCol": "...", "rl": "..." }
        },
        "entityId": "col_owner_001"
      },
      // ... more entries
    ]
  }
}
```

Each entry references its child contract by `(op, version)`. Replay re-validates `params` against the current `contract.schema` so contract drift surfaces as a clean error rather than silent corruption.

## Decorator semantics — quick reference

The `@TraceCommand` decorator opens an `AsyncLocalStorage` scope on the **outermost** call in an async tree. Subsequent traced calls in the same async context take one of three branches:

| Outer scope state | Inner traced call behaviour |
|---|---|
| **None** (no outer scope) | This is the outermost call — opens a new scope, runs the full record flow. |
| **Active, no transcript** | Re-entrant skip. The method runs but `recordCommand` does NOT fire. (Used by cascading deletes etc. — `tableDelete` → per-column `columnDelete` records one row.) |
| **Active, with transcript** | Auto-instrument. Opens a child capture scope, runs the method, appends one `MacroTranscriptEntry` to the outer transcript. |

Re-entrancy is automatic — never set manual flags on `req` or `params`.

`isReplay()` (`helpers/replayScope.ts`) is a **separate** ALS — it tracks whether we're inside `runInReplay`, used by model insert paths to honour pre-set ids and skip recording. It is independent of the trace scope.

## Other primitives worth knowing

| Helper (`trace-command.decorator.ts` / `replay-context.ts`) | What it's for |
|---|---|
| `dispatchOperation(ctx, contract, handler, call)` | Single source of truth for replay invocation: builds replay-time `req`, spreads `req`/`user` into params, rewrites `baseId` to target, injects `entityId` via `id_field`, builds `HandlerMeta`, wraps in `runInReplay`. Used by all three replay paths. Touch this when you change replay semantics. |
| `dispatchTranscriptEntry(ctx, entry, req)` | Resolves a transcript entry's `(op, version)`, re-validates against the current schema (drift guard), then routes through `dispatchOperation`. Used by the macro forward-replay branch and `macroUndo`. |
| `runInChildTraceScope(fn)` | Opens an isolated child capture bag. Used by macro auto-instrument and any flow that needs per-child capture isolation. |
| `runUntraced(fn)` | Opens an outer scope with no `transcript` so any nested `@TraceCommand` calls take the silent-skip branch. Use for system-driven cleanup (trash permanent-delete, retention sweeps) that fan out to traced services but should not themselves record. |
| `registerForward(contract, fn)` | Default registration shorthand for handlers that don't need `meta`. |
| `registerMacro(contract, fn)` | Auto-routes forward vs. replay for macro contracts. |

## Common gotchas

| Symptom | Likely cause |
|---|---|
| Service runs but no row in `nc_operation_logs` | (a) `req` lacks `ncTabId` (no `x-nc-tab-id` header on the request); (b) `contract.undo?.inverse` returns `null` (most often because `resolvedCtx.extra` is empty — entry.before either didn't run or returned no extra); (c) the call is inside `runInReplay`. |
| `meta.extra.<key>` missing on the row | Key not added to `contract.sandbox.capture` — the allowlist gates persistence even if `captureForTrace` was called. |
| Replay creates a fresh id instead of preserving the original | (a) `sandbox.id_field` not set on the contract; (b) the model insert path doesn't honour `isReplay() && entity.id`; (c) for side-effect ids: the registered handler isn't `setReplay`-ing from `meta.extra` before forwarding. |
| Multi-LTAR / multi-filter bulk loses ids on undo→redo | Without macro auto-instrument, sibling children write to the same flat `ltar` / `filters` capture key and overwrite each other. Mark the parent contract `macro: true`. |
| Test fails with "OperationRegistry frozen" | A handler `register()` call ran after `OperationRegistry.freeze()` (called once in `OperationRegistryBootstrap.onApplicationBootstrap`). Move the registration into a `register<Feature>Handlers` function and add the call to bootstrap. |

## Bumping a contract version

Bump `contract.version` when the schema or replay semantics change in a way old persisted rows can't replay against the new contract. v1 and v2 coexist until v1 rows drain from the active stack.

```ts
// register both versions:
registerForward(MyV1Contract, (ctx, p) => svc.fooV1(ctx, p));
registerForward(MyV2Contract, (ctx, p) => svc.fooV2(ctx, p));
```

`OperationRegistry.resolve(name, version)` picks the version recorded on the row.

## Tests

- Schema unit tests: `tests/unit/command-registry/_schemas/*.spec.ts` — strict / required / enum / nested-children.
- Resolver tests: `tests/unit/command-registry/resolver.spec.ts` — version drift, freeze, contract lookup.
- Sandbox id-preservation: `tests/unit/rest/tests/internal/ee/sandbox-id-preservation.test.ts` — gates new replay ids: extend `IdSnapshot` + `collectIds` for any new entity.
