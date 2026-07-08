import { FormulaDataTypes } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import { NC_MAX_TEXT_LENGTH } from '~/constants';

export interface IGetAggregateFn {
  (fnName: string): (args: { qb; knex?: CustomKnex; cn }) => any;
}

// Formula functions whose rendered SQL yields a JSON/JSONB value rather than a
// plain text string. On Postgres these come back as jsonb and the driver
// auto-parses them — casting to ::text (which the length-cap wrapper does)
// would change the value's representation (e.g. wrap a string in quotes). Such
// formulas only extract from already-stored JSON and cannot grow unbounded, so
// they're excluded from the output-length cap below.
const JSON_OUTPUT_FORMULA_FNS = new Set(['JSON_EXTRACT']);

const isNullBranch = (node: any): boolean =>
  !node ||
  node.dataType === FormulaDataTypes.NULL ||
  (node.type === 'Literal' && node.value === null);

// Whether a formula's final expression renders to a raw JSON/JSONB value. IF and
// SWITCH preserve a raw JSON output only when every (non-null) result branch is
// itself raw JSON — mixed-type branches are cast to text by the function itself.
export const formulaOutputsRawJson = (node: any): boolean => {
  if (!node || typeof node !== 'object' || node.type !== 'CallExpression') {
    return false;
  }

  const name = node.callee?.name?.toUpperCase?.();
  if (!name) return false;

  if (JSON_OUTPUT_FORMULA_FNS.has(name)) return true;

  if (name === 'IF') {
    const branches = [node.arguments?.[1], node.arguments?.[2]].filter(
      (b) => !isNullBranch(b),
    );
    return branches.length > 0 && branches.every(formulaOutputsRawJson);
  }

  if (name === 'SWITCH') {
    const args = node.arguments ?? [];
    const branches: any[] = [];
    // SWITCH(expr, when1, then1, when2, then2, ... [, else]) — results sit at
    // the even indices from 2 onward, plus a trailing else when arity is even.
    for (let i = 2; i < args.length; i += 2) branches.push(args[i]);
    if (args.length % 2 === 0) branches.push(args[args.length - 1]);
    const real = branches.filter((b) => !isNullBranch(b));
    return real.length > 0 && real.every(formulaOutputsRawJson);
  }

  return false;
};

// Hard upper bound on the rendered length (in characters) of a formula's
// string output. Some formula functions (e.g. REPEAT, or CONCAT over large
// lookup/long-text values) can generate strings large enough to crash the
// Node process with ERR_STRING_TOO_LONG when the database driver materializes
// them — V8's max string length is ~512MB and pg-protocol's read of an
// oversized value cannot be caught. Capping the output at the database level
// (via SUBSTR) guarantees the driver never streams back more than this many
// characters per cell, regardless of the database platform.
//
// Defaults to NC_MAX_TEXT_LENGTH (100k) — the same limit LongText columns are
// truncated to on read (see select-object.ts) — so a formula's string value
// stays consistent with other text values and can be pasted into a text field.
// A dedicated NC_FORMULA_MAX_OUTPUT_LENGTH env var can override this when a
// different formula-specific cap is needed.
export const getFormulaOutputMaxLength = (): number => {
  const override = Number(process.env.NC_FORMULA_MAX_OUTPUT_LENGTH);
  if (Number.isFinite(override) && override > 0) {
    return Math.floor(override);
  }
  return NC_MAX_TEXT_LENGTH;
};

// Wrap a formula's final string expression so the database truncates the value
// to at most `maxLength` characters. Cross-platform: SUBSTR with a leading CAST
// to a textual type works on Postgres, MySQL/MariaDB, SQLite, SQL Server,
// Snowflake and Databricks. The cast keeps the wrapper safe even if the inner
// expression isn't already a text type.
export const wrapFormulaWithMaxLength = ({
  knex,
  builder,
  maxLength,
}: {
  knex: CustomKnex;
  builder: any;
  maxLength: number;
}) => {
  // `maxLength` is bound as a single builder parameter only; the length is
  // inlined as a literal integer rather than a second `?` binding. The inner
  // `builder` can itself be a subquery carrying its own `?` placeholders (e.g.
  // a formula string literal), and knex flattens nested bindings positionally —
  // a trailing `?` would steal one of those slots and corrupt the query.
  // `getFormulaOutputMaxLength()` guarantees a positive, floored integer, so
  // inlining it is injection-safe.
  const len = Math.max(1, Math.floor(maxLength));
  switch (knex.clientType()) {
    case 'pg':
      return knex.raw(`SUBSTR((?)::text, 1, ${len})`, [builder]);
    case 'mssql':
      return knex.raw(`SUBSTRING(CAST(? AS NVARCHAR(MAX)), 1, ${len})`, [
        builder,
      ]);
    case 'oracledb':
      // Oracle reads `CAST(x AS CHAR)` (the mysql default below) as CHAR(1),
      // truncating every value to one character, and `CAST(<clob> AS CHAR)`
      // raises ORA-25137. SUBSTR over TO_CLOB(x) keeps the result a CLOB (TO_CLOB
      // is identity on CLOB/VARCHAR2/NUMBER), so it can carry the full
      // NC_MAX_TEXT_LENGTH (100k) — a plain SQL VARCHAR2 caps at 4000/32767 and
      // would truncate. A CLOB can't be used in GROUP BY / DISTINCT (ORA-22849),
      // but no caller groups by the raw formula output: the widget category
      // path narrows it to a VARCHAR2 separately (oracleWidgetCategoryExpr).
      return knex.raw(`SUBSTR(TO_CLOB(?), 1, ${len})`, [builder]);
    case 'sqlite3':
      return knex.raw(`SUBSTR(CAST(? AS TEXT), 1, ${len})`, [builder]);
    case 'snowflake':
    case 'databricks':
      return knex.raw(`SUBSTR(CAST(? AS STRING), 1, ${len})`, [builder]);
    case 'mysql':
    case 'mysql2':
    case 'mariadb':
    default:
      return knex.raw(`SUBSTR(CAST(? AS CHAR), 1, ${len})`, [builder]);
  }
};

// SQL Server's `bit` (Checkbox) type is invalid for SUM/AVG/MIN/MAX. In this
// lookup-aggregation context the parent is a numeric formula function, so the
// aggregated values are numeric/bit — cast a `bit` column to FLOAT (harmless
// for other numeric types) so the aggregate works. Only applied when `cn` is a
// plain column identifier; a raw subquery is left as-is (aggregating over a
// subquery is a separate, cross-dialect limitation that a cast can't fix).
const mssqlNumericCn = (qb: any, cn: any) =>
  typeof cn === 'string' && qb?.client?.driverName === 'mssql'
    ? qb.client.raw('CAST(?? AS FLOAT)', [cn])
    : cn;

export const getAggregateFn: IGetAggregateFn = (parentFn) => {
  switch (parentFn?.toUpperCase()) {
    case 'MIN':
      return ({ qb, cn }) => qb.clear('select').min(mssqlNumericCn(qb, cn));
    case 'MAX':
      return ({ qb, cn }) => qb.clear('select').max(mssqlNumericCn(qb, cn));
    case 'ADD':
    case 'SUM':
    case 'FLOAT':
    case 'NUMBER':
    case 'ARITH':
      return ({ qb, cn }) => qb.clear('select').sum(mssqlNumericCn(qb, cn));

    case 'AVG':
      return ({ qb, cn }) => qb.clear('select').sum(mssqlNumericCn(qb, cn));

    case 'ARRAY_AGG':
      return ({ qb, knex, cn }) =>
        qb.clear('select').select(knex.raw(`ARRAY_AGG(??)`, [cn]));

    case 'NO_AGG':
      return ({ qb, knex, cn }) =>
        qb.clear('select').select(knex.raw(`??`, [cn]));

    // todo:
    //   return ({ qb, cn, knex, argsCount }) =>
    //     qb
    //       .clear('select')
    //       .select(
    //         knex.raw('sum(??)/(count(??)) + ?)', [cn, cn, (argsCount || 1) - 1])
    //       );
    case 'FIRST':
      // Return the first linked value in display order.  The subquery already
      // has ORDER BY nc_order, so LIMIT 1 gives the first record.
      return ({ qb, cn }) => qb.clear('select').select(cn).limit(1);

    case 'CONCAT':
    default:
      // `_ncLinkOrderRef` (opt-in, PG only) is stashed on the row query by the
      // lookup/LTAR builder for ordered mm links; absent for every other case,
      // so the aggregate SQL is unchanged there.
      return ({ qb, cn }) =>
        qb.clear('select').concat(cn, (qb as any)?._ncLinkOrderRef);
  }
};
