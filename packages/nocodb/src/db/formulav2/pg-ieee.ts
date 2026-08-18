import type CustomKnex from '~/db/CustomKnex';

// `numeric` cannot hold Infinity before PG 14 ("invalid input syntax for type
// numeric"), and NocoDB Number/Decimal columns map to numeric/decimal. Every
// IEEE literal here is double precision so the CASE branches unify as float8.
const IEEE_TYPE = 'double precision';

export function isPgClient(knex: CustomKnex): boolean {
  return knex.clientType() === 'pg';
}

export function coalesceNumericOperand(
  sql: string,
  knex: CustomKnex,
): string {
  if (!isPgClient(knex)) return sql;
  return `COALESCE(${sql}, 0)`;
}

// Airtable semantics: x/0 -> ±Infinity, 0/0 -> NaN. PG raises `division by
// zero` rather than producing Infinity, so the value is constructed explicitly.
export function ieeeDivisionSql(left: string, right: string): string {
  return (
    `(CASE WHEN (${right}) <> 0 THEN (${left}) / (${right}) ` +
    `WHEN (${left}) = 0 THEN 'NaN'::${IEEE_TYPE} ` +
    `WHEN (${left}) > 0 THEN 'Infinity'::${IEEE_TYPE} ` +
    `ELSE '-Infinity'::${IEEE_TYPE} END)`
  );
}

// IEEE fmod(x, 0) is NaN; PG's MOD() raises division by zero instead.
// PG has no mod(double precision, double precision) — MOD is defined for
// integer/numeric only — so the division itself goes through numeric and the
// result is cast back to float8 to match the NaN branch. `numeric` appears only
// on the non-zero path, so this stays safe on PG < 14 where numeric has no
// Infinity.
export function ieeeModuloSql(left: string, right: string): string {
  return (
    `(CASE WHEN (${right}) <> 0 ` +
    `THEN MOD((${left})::numeric, (${right})::numeric)::${IEEE_TYPE} ` +
    `ELSE 'NaN'::${IEEE_TYPE} END)`
  );
}
