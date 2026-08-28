/** The generated-SQL ceiling enforced in formulaQueryBuilderv2. */
export const MAX_GENERATED_SQL_BYTES = 500 * 1000;

/**
 * Ceiling on the WHOLE statement — expression plus every hoisted block body.
 * MAX_GENERATED_SQL_BYTES only measures the expression, and hoisting moves the
 * bulk into blocks that `applyCte` splices in afterwards, so without this the
 * measured size goes flat while the statement Postgres receives keeps growing
 * (measured: 215 KB reported against 494 KB actual). Set above the expression
 * cap because a hoisted statement is legitimately larger than its expression —
 * the headroom is the point, not slack. Env-overridable so tests can trip it
 * without building a multi-hundred-kb fixture.
 */
export function maxStatementBytes() {
  return process.env.NC_FORMULA_MAX_STATEMENT_BYTES
    ? +process.env.NC_FORMULA_MAX_STATEMENT_BYTES
    : 700 * 1000;
}

/**
 * Try hoisting once measured generated SQL passes this. Expressed in bytes
 * because that is what the cap is in and what `toSQL().sql.length` already
 * reports — an earlier design estimated bytes from leaf paths and was wrong
 * by ~97× between schemas (identifier lengths, junction joins and per-hop
 * filters dominate), so nothing here is derived from path counts.
 */
export function hoistAboveBytes() {
  return process.env.NC_FORMULA_CTE_HOIST_BYTES
    ? +process.env.NC_FORMULA_CTE_HOIST_BYTES
    : 200 * 1000;
}

/**
 * Minimum inline:hoisted leaf-path ratio worth rebuilding for. A formula
 * referencing each operand once has ratio 1 — hoisting rewrites its SQL for
 * no saving, so skip it and let the cap error stand.
 */
export const MIN_HOIST_RATIO = 1.5;
