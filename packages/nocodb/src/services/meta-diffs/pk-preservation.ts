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
 *
 * Tests in `tests/unit/helpersTest/pkPreservation.test.ts` lock the
 * behavior.
 */

export interface ColumnPropsForDiff {
  pk?: boolean | null;
  rqd?: boolean | null;
  un?: boolean | null;
  ai?: boolean | null;
  unique?: boolean | null;
}

/** True when NocoDB has pk and the DB column does not. */
export function isPkRegression(
  noCoDbPk: boolean | null | undefined,
  dbPk: boolean | null | undefined,
): boolean {
  return !!noCoDbPk && !dbPk;
}

/**
 * Returns true if the diff between `oldCol` (NocoDB) and `dbCol` (DB)
 * should fire `TABLE_COLUMN_PROPS_CHANGED` and queue an apply.
 *
 * `pk` regressions alone do NOT fire — see module-level rationale.
 */
export function detectColumnPropsChanged(
  oldCol: ColumnPropsForDiff,
  dbCol: ColumnPropsForDiff,
): boolean {
  const pkChanged =
    !!oldCol.pk !== !!dbCol.pk && !isPkRegression(oldCol.pk, dbCol.pk);

  return (
    pkChanged ||
    !!oldCol.rqd !== !!dbCol.rqd ||
    !!oldCol.un !== !!dbCol.un ||
    !!oldCol.ai !== !!dbCol.ai ||
    !!oldCol.unique !== !!dbCol.unique
  );
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
