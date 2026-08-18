import type CustomKnex from '~/db/CustomKnex';

// `numeric` cannot hold Infinity before PG 14 ("invalid input syntax for type
// numeric"), and NocoDB Number/Decimal columns map to numeric/decimal. Every
// IEEE literal here is double precision so the CASE branches unify as float8.
const IEEE_TYPE = 'double precision';

export function isPgClient(knex: CustomKnex): boolean {
  return knex.clientType() === 'pg';
}

export function coalesceNumericOperand(sql: string, knex: CustomKnex): string {
  if (!isPgClient(knex)) return sql;
  return `COALESCE(${sql}, 0)`;
}

// Finite test that mentions the operand once. NaN and ±Infinity both fail it —
// pg ranks NaN above every number, so `abs(NaN) < Infinity` is false — and NULL
// stays NULL. Spelling it out with three <> comparisons would inline the
// operand three times, which matters because these nest.
export function isFiniteSql(expr: string): string {
  return `abs(${expr}) < 'Infinity'::${IEEE_TYPE}`;
}

// Airtable semantics: x/0 -> ±Infinity, 0/0 -> NaN. pg raises `division by
// zero` rather than producing the value, so it has to be introduced by hand —
// but pg's own arithmetic *is* IEEE once an Infinity exists, so `x * Infinity`
// resolves all three cases with the correct sign (5→Infinity, -5→-Infinity,
// 0→NaN, NULL→NULL). That keeps each operand to two appearances; branching on
// the sign of `left` instead would inline it three times, and since `/` is
// left-associative the outer left operand is the inner CASE — chained division
// would then grow 3ⁿ instead of 2ⁿ.
export function ieeeDivisionSql(left: string, right: string): string {
  return (
    `(CASE WHEN (${right}) <> 0 THEN (${left}) / (${right}) ` +
    `ELSE (${left}) * 'Infinity'::${IEEE_TYPE} END)`
  );
}

// IEEE fmod(x, 0) is NaN, and so is fmod(±Infinity, y) and fmod(NaN, y) — one
// guard covers all of them. pg has no mod(double precision, double precision)
// (MOD is integer/numeric only), so the real path goes through numeric and
// casts back; the guard is what keeps a non-finite operand out of that cast,
// which would raise on pg < 14 where numeric has no Infinity.
export function ieeeModuloSql(left: string, right: string): string {
  return (
    `(CASE WHEN (${right}) <> 0 AND ${isFiniteSql(left)} ` +
    `THEN MOD((${left})::numeric, (${right})::numeric)::${IEEE_TYPE} ` +
    `ELSE 'NaN'::${IEEE_TYPE} END)`
  );
}

// NaN satisfies no ordering comparison, but pg ranks it above every number, so
// a bare `x > 100` takes the true branch. NULL fails every comparison, which is
// the semantics NaN should have had, and it lands correctly in both contexts:
// an IF condition falls through to ELSE, and a standalone comparison is wrapped
// in `CASE WHEN … THEN true ELSE false END`. One operand mention, so this costs
// nothing in query length.
export function stripNaNSql(expr: string): string {
  return `NULLIF(${expr}, 'NaN'::${IEEE_TYPE})`;
}

// Aggregation resolves a formula to the same IEEE value the cell shows, but a
// single NaN would poison SUM/AVG/MAX for the whole column, so error rows are
// dropped to NULL and skipped here instead. This is the only consumer that
// needs it — filters, sorts and group keys all want the value itself.
export function excludeNonFiniteSql(expr: string): string {
  return `(CASE WHEN ${isFiniteSql(expr)} THEN (${expr}) END)`;
}
