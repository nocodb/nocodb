/**
 * Pure helpers for column-property diff between NocoDB metadata and the
 * external DB schema, with asymmetric handling of `pk`.
 *
 * Customers can recover from external schemas that declare uniqueness via
 * `UNIQUE NOT NULL` instead of `PRIMARY KEY` (the no-PK family of read /
 * delete / link-create crashes) by manually flagging the `id` column as PK
 * in NocoDB. To make that flip durable, the diff is asymmetric on `pk`:
 *
 *   - `pk` *gained* on the DB side: propagate to NocoDB.
 *   - `pk` *lost* on the DB side while NocoDB has it: keep NocoDB's value.
 *
 * Other props (`rqd`, `un`, `ai`, `unique`) are propagated symmetrically.
 * `readonly` follows the DB only for PG generated columns, marked by
 * `internal_meta.pg_generated`; a readonly NocoDB set itself (AutoNumber,
 * UUID, synced fields) is never cleared.
 *
 * Tests in `tests/unit/helpersTest/pkPreservation.test.ts` lock the
 * behavior.
 */

/**
 * Subset of column attributes that meta-sync compares against the DB
 * schema: primary key, required (NOT NULL), unsigned, auto-increment,
 * UNIQUE. These are physical / schema-level properties — *not*
 * NocoDB-only metadata such as title, description, or uidt.
 */
export interface ColumnSchemaProps {
  pk?: boolean | null;
  rqd?: boolean | null;
  un?: boolean | null;
  ai?: boolean | null;
  unique?: boolean | null;
  readonly?: boolean | null;
  internal_meta?: { pg_generated?: boolean } | null;
}

/** True when NocoDB has pk and the DB column does not. */
export function isPkRegression(
  noCoDbPk: boolean | null | undefined,
  dbPk: boolean | null | undefined,
): boolean {
  return !!noCoDbPk && !dbPk;
}

/**
 * Returns true if the schema-level props on `oldCol` (NocoDB metadata)
 * and `dbCol` (DB schema) disagree in a way that should fire
 * `TABLE_COLUMN_PROPS_CHANGED` and queue an apply.
 *
 * Compares only physical/constraint-like attributes (pk, rqd, un, ai,
 * unique) — not NocoDB-only metadata such as title or uidt.
 *
 * `pk` regressions alone do NOT fire — see module-level rationale.
 */
export function detectColumnSchemaPropsChanged(
  oldCol: ColumnSchemaProps,
  dbCol: ColumnSchemaProps,
): boolean {
  const pkChanged =
    !!oldCol.pk !== !!dbCol.pk && !isPkRegression(oldCol.pk, dbCol.pk);

  return (
    pkChanged ||
    !!oldCol.rqd !== !!dbCol.rqd ||
    !!oldCol.un !== !!dbCol.un ||
    !!oldCol.ai !== !!dbCol.ai ||
    !!oldCol.unique !== !!dbCol.unique ||
    resolveGeneratedReadonlyAfterSync(oldCol, dbCol) !== null
  );
}

/**
 * The `readonly` change a sync applies for a PG generated column, or null for
 * none: a column that became generated turns readonly and gets the marker; one
 * that stopped (PG 13+ `DROP EXPRESSION`) turns writable again — only when the
 * marker shows introspection set the readonly.
 */
export function resolveGeneratedReadonlyAfterSync(
  oldCol: ColumnSchemaProps,
  dbCol: ColumnSchemaProps,
): { readonly: boolean; pg_generated: boolean } | null {
  const wasGenerated = !!oldCol.internal_meta?.pg_generated;
  if (dbCol.internal_meta?.pg_generated) {
    return oldCol.readonly && wasGenerated
      ? null
      : { readonly: true, pg_generated: true };
  }
  return wasGenerated ? { readonly: false, pg_generated: false } : null;
}

/**
 * Returns the `pk` value to write back to NocoDB after a sync diff fires.
 * Acts as a ratchet — pk only goes from false to true, never back.
 */
export function resolvePkAfterSync(
  noCoDbPk: boolean | null | undefined,
  dbPk: boolean | null | undefined,
): boolean {
  return !!(dbPk || noCoDbPk);
}
