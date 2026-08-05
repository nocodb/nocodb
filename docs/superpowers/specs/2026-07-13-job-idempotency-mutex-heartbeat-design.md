# Job idempotency via distributed mutex + heartbeat

**Date:** 2026-07-13
**Status:** Approved (design) — pending implementation plan
**Area:** `packages/nocodb` — jobs runtime (Bull), EE base duplication

## Problem

A `duplicateBase` job intermittently fails with:

```
CREATE TABLE "p1o3asxws02z2cl"."Sample Views" ( ... );
- duplicate key value violates unique constraint "pg_class_relname_nsp_index"
```

This surfaces as the **"duplicateBase Priority Error Alert"** — emitted from the duplicate
processor's catch block
(`src/ee/modules/jobs/jobs/export-import/duplicate.processor.ts:598-603`,
`telemetryService.sendSystemEvent({ event_type: 'priority_error', error_trigger: 'duplicateBase', message: err.message, ... })`).
The raw knex error message embeds the failing `CREATE TABLE` SQL, which is why the alert
text is the full statement.

### Root cause

`pg_class_relname_nsp_index` is Postgres's unique index on `pg_class(relname, relnamespace)`.
The error code is **`23505` (unique_violation)** — NOT the friendly `42P07`
(`relation "..." already exists`).

- A **single session** re-creating an existing relation is pre-checked via syscache in
  `heap_create_with_catalog` and raises the friendly **`42P07`**.
- **Two concurrent sessions** creating the same relation both pass the pre-check under
  `READ COMMITTED` (neither sees the other's uncommitted `pg_class` row), both `INSERT`
  into `pg_class`, and the second to commit trips the unique index → **`23505` on
  `pg_class_relname_nsp_index`**.

So the table was created by **two DB sessions racing to `CREATE TABLE` the same name in the
same schema** — a concurrency signature, not simple re-existence.

### Why two sessions hit the same schema

- Each `duplicateBase` API call creates a **fresh** destination base (new id → new PG schema,
  `schema = baseId`). Two *independent* requests target *different* schemas and cannot
  collide. A same-schema collision requires **two executions of the same job**
  (same `dupProjectId`).
- The queue is **Bull** (`@nestjs/bull`, `import { Job } from 'bull'`,
  `src/modules/jobs/jobs.processor.ts`), default `lockDuration` 30s with automatic
  **stalled-job re-delivery**.
- Worker runs `@Process({ concurrency: NC_WORKER_CONCURRENCY })`, default **10**
  (`parseWorkerConcurrency`, `src/interface/Jobs.ts:162`) — up to 10 jobs share one Node
  event loop; horizontal scaling adds more worker processes.
- A long duplication (schema apply + data import) whose lock-renewal is delayed (event-loop
  jitter / GC pause / cross-process stalled-check) is declared **stalled** and re-dispatched
  **while the original is still running** → two executions run `applyMeta →
  handleTableCreations` against the same schema → concurrent `CREATE TABLE` → `23505`.

### Why existing guards don't save it

`src/ee/helpers/baseMetaHelpers.ts:950-963` already catches `42P07` (the sequential
re-run / orphaned-table case) and skips DDL — but it re-throws everything else, so the
concurrent-race `23505` propagates and fails the whole job (which then deletes the target
base and fires the priority alert).

## Existing building blocks (reused)

- `src/ee/helpers/lockHelpers.ts` — `acquireLock(lockKey, lockId, maxWaitTimeMs, ttlSeconds)`
  and `releaseLock(lockKey, lockId)`, a distributed mutex over `NocoCache.setExpiring`
  (fixed TTL, ownership-checked release, **no renewal**). Works with Redis and falls back to
  in-memory `NocoCache` when Redis is absent. **Note:** its only deps are `NocoCache` and
  `CacheGetType` (both CE) — it is not EE-specific; see CE/EE relocation below.
- `JobsProcessor.process()` (`src/modules/jobs/jobs.processor.ts:46`) and its `requeue(job)`
  method (exponential backoff 5s→60s, `JOB_REQUEUE_LIMIT = 60`, `jobRequeueDelay`).
- Terminal-state signal on the destination base: created with `status: ProjectStatus.JOB`
  (`ProjectStatus.JOB = 'job'`), flipped to `status: null` on success
  (`duplicate.processor.ts:530-539`); the base is **deleted** on failure via
  `cleanupFailedDuplication` (`:583`).

## Design

Three parts: a **generic** mutual-exclusion guard, a new **heartbeat** helper, and a
**duplicate-specific** terminal guard that makes the requeue path safe.

### Part A — generic guard in `JobsProcessor.process()` (opt-in allowlist)

Wrap the job-execution body in an acquire → heartbeat → release envelope, gated by an
allowlist so it currently activates only for base duplication:

```ts
const IDEMPOTENT_JOBS = new Set<string>([JobTypes.DuplicateBase]); // extend later
```

- **Lock key:** `job:lock:${job.id}` — the Bull job id. Stalled re-delivery and the explicit
  `requeue()` path both reuse the same id, so this exactly dedupes the double-run and is a
  natural universal key for future job types.
- **lockId:** a fresh nanoid **per execution attempt**, so heartbeat renewal and
  ownership-checked release only ever touch a lock this attempt owns.
- **Acquire:** try-once (`maxWaitTimeMs: 0`) via `acquireLock`.
  - **Won** → start heartbeat; run the handler; `finally` stop heartbeat + `releaseLock`.
  - **Lost** (a live sibling holds it) → `this.requeue(job)` (reuses existing backoff).
- Jobs **not** in the allowlist run exactly as today (no lock).

> **CE/EE relocation (prerequisite for Part A).** There is no EE `JobsProcessor` override —
> the guard lives in the CE processor (`src/modules/jobs/jobs.processor.ts`), and
> `DuplicateBase` is a CE-registered job (`src/modules/jobs/jobs-map.service.ts`). CE code
> must not import from `ee/`. Since `lockHelpers.ts` has only CE dependencies, **move it from
> `src/ee/helpers/lockHelpers.ts` to `src/helpers/lockHelpers.ts`** (`git mv`). All four
> existing EE importers reference it as `~/helpers/lockHelpers`, which continues to resolve
> via the EE overlay's fallthrough to `src/*` — **no import statements change**. Do not keep
> a stale EE copy (it would shadow the CE version and lack `renewLock`).

### Part B — `renewLock` helper (periodic signalling)

Add to `src/helpers/lockHelpers.ts` (post-relocation):

```ts
renewLock(lockKey, lockId, ttlSeconds): Promise<boolean>
// reads current holder; if holder.lockId === lockId, re-setExpiring to reset TTL; else false
```

Heartbeat in the wrapper: `setInterval` calling `renewLock` every **~30s**; lease **TTL
~150s**.

**Rationale — TTL ≫ Bull's 30s `lockDuration`:** Bull's native renewal is twitchy; a brief
GC pause or event-loop burst over 30s makes Bull declare the job stalled and re-dispatch it
(the root cause). Our lease is deliberately generous (~5× Bull's window), so the same
transient jitter that trips Bull does **not** expire our lock — the re-dispatched sibling
just loses the acquire and requeues. Steady-state heartbeat keeps the lease alive; a genuine
crash stops the heartbeat and the lease auto-expires in ~150s, freeing it for takeover.

The heartbeat interval / TTL should be defined as named constants (single source of truth),
with TTL ≥ ~4× the heartbeat interval to tolerate several missed ticks.

### Part C — duplicate-specific terminal guard

At the top of the V3 duplicate job (`duplicate.processor.ts`), after re-fetching the target
base, no-op when it is already terminal:

```ts
if (!targetBase || targetBase.status !== ProjectStatus.JOB) {
  // deleted (a prior attempt failed + cleaned up) or already completed (status === null)
  return;
}
```

This prevents a **post-completion** requeued copy from re-running `applyMeta` and, crucially,
**re-importing data (duplicate rows)**. Separation of concerns: the generic wrapper provides
mutual exclusion; the job owns its own completion idempotency.

## Behavior across scenarios

| Scenario | Outcome |
|---|---|
| Stalled re-delivery while original alive | sibling loses acquire → requeues; original finishes → `status:null` + releases; sibling's next requeue sees `status !== 'job'` → no-op |
| Original crashes hard (catch never runs) | heartbeat stops → lease expires (~150s) → requeue acquires → base still `status === 'job'` with partial tables → resumes; existing `42P07` / metadata-exists guards keep the re-run idempotent |
| Original fails (catch runs) | target base deleted → lock released → requeue sees base gone → no-op |
| No Redis (in-memory fallback + PQueue) | single process, cannot double-deliver; in-memory `acquireLock` always succeeds → harmless |

## Decisions

- **Scope:** build the guard generically (allowlist-gated at the processor), **activate only
  for `DuplicateBase`** for now.
- **On conflict:** losing execution **requeues with delay** (reuses existing backoff) rather
  than skipping — doubles as crash-recovery/resume.
- **Lease params:** heartbeat ~30s, TTL ~150s (named constants; TTL ≥ ~4× interval).
- **`23505` defense-in-depth:** **deferred / out of the core change.** With the mutex,
  concurrent DDL should not occur. `acquireLock` is check-then-set (a small race window), so
  optionally swallowing `23505` on `pg_class_relname_nsp_index` in the existing `42P07` guard
  (`baseMetaHelpers.ts:954`) is cheap belt-and-suspenders — added only if desired later.

## Files expected to change

- `src/ee/helpers/lockHelpers.ts` → **`src/helpers/lockHelpers.ts`** (`git mv`, CE/EE
  relocation) — and add `renewLock`. No changes to the 4 existing `~/helpers/lockHelpers`
  importers.
- `src/modules/jobs/jobs.processor.ts` — allowlist + acquire/heartbeat/release envelope +
  requeue-on-conflict.
- `src/ee/modules/jobs/jobs/export-import/duplicate.processor.ts` — Part C terminal guard.
- New constants for lock-key prefix / TTL / heartbeat interval — colocated with the lock
  helper in `src/helpers/lockHelpers.ts` (single source of truth for the lease timing).

## Testing

- Unit: `renewLock` renews own lock, refuses a foreign lock, and the lease expires without
  heartbeat.
- Integration-style: two executions of one job id → second requeues while first holds the
  lock; first completes and flips status → second's requeue no-ops on terminal status.
- Per standing preference, tests are written only if explicitly requested.

## Out of scope

- Changing Bull's `lockDuration` / worker concurrency defaults.
- Job de-duplication at enqueue time (distinct concern — this addresses same-job
  re-execution, not double-enqueue).
- Making physical DDL part of the metadata transaction.
