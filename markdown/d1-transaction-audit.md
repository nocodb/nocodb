# Cloudflare D1 Transaction Audit

Cloudflare D1 support is scoped to external sources. D1 is SQLite-compatible for
query generation, introspection, and type mapping, but it does not expose
long-lived interactive transactions through the REST API.

NocoDB therefore uses these rules:

- Use normal read/write queries for single-statement CRUD.
- Use D1 atomic batch execution when every statement and binding can be
  compiled before the write starts.
- Mark interactive transaction blocks as best-effort instead of pretending
  `BEGIN`, `COMMIT`, and `ROLLBACK` can be held open over REST.

## Capabilities

The backend exposes D1 with these capabilities:

```ts
{
  readWrite: true,
  atomicBatch: true,
  interactiveTransactions: false,
  ddlTransactions: false,
  bestEffortInteractiveWrites: true
}
```

## Covered Paths

These paths are D1-aware today:

- Knex adapter query execution through the Cloudflare D1 REST query endpoint.
- D1 atomic batch execution through the adapter batch helper.
- Transaction control SQL no-op with a once-per-process warning.
- Bulk insert fallback batches when pre/post generated ops are not present.
- Bulk delete cleanup statements.
- Generated raw SQL operation groups through `runOps`.
- Many-to-many link add final write groups, including conflict cleanup followed
  by junction-table insert.

## Remaining Hotspots

These paths still need case-by-case review before they can be called fully
atomic on D1:

- Schema and DDL migrations in `KnexMigratorv2`. These often mix DDL and
  metadata bookkeeping. D1 can batch precompiled statements, but DDL rollback
  semantics should be audited per migration path.
- LTAR bulk updates that perform reads, compare existing links in application
  code, and then call add/remove link operations. The final writes can often be
  batched, but the whole read-decide-write workflow is not a single interactive
  transaction on D1 REST.
- Update and delete flows where the next statement depends on an application
  decision made from a previous query result.
- Audit-log writes and broadcast callbacks. These intentionally run after core
  data writes and should not be represented as part of the D1 atomic data batch.

## Rewrite Candidates

The safest future improvements are:

- Generate deterministic IDs before insert where possible, so parent/child
  inserts can be compiled into a single D1 batch.
- Use SQLite `RETURNING` or CTE-based SQL for selected dependent writes where
  D1 supports the resulting statement shape.
- Split schema changes into audited precompiled D1 batches only when every DDL
  statement and metadata update can be produced upfront.
- Continue moving final write groups in linked-record flows into D1 batches
  after all validation reads have completed.

## Non-goals

- Do not emulate interactive transactions with local state.
- Do not show D1 as a NocoDB metadata database.
- Do not treat SQLite file lifecycle, upload, path validation, or duplicate file
  checks as D1 behavior.
