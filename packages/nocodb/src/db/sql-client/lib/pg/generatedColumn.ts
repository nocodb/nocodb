/**
 * `GENERATED ALWAYS AS (expr) STORED`: PG computes the value and rejects any
 * written one, so the column is never required and never writable — even when
 * it is NOT NULL or the primary key (inserts read it back via RETURNING).
 * `au` is not used here: on PG it means an `xc_trigger_*` updated-at column.
 */
export function applyPgGeneratedColumnProps(
  column: Record<string, any>,
  generationExpression: string | null | undefined,
) {
  if (!generationExpression) return column;
  column.rqd = false;
  column.readonly = true;
  return column;
}
