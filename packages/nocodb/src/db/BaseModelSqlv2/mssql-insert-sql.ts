import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column } from '~/models';

/**
 * MSSQL insert SQL helpers
 *
 * SQL Server quirks these helpers exist for:
 *
 *  1. **Triggers** — `OUTPUT INSERTED.*` (what knex emits for `.returning()`)
 *     fails on trigger-bearing tables with T-SQL error 334. Fix:
 *     `OUTPUT INSERTED.<col> INTO @table` form — accepted on all tables.
 *
 *  2. **IDENTITY_INSERT** — `INSERT` with an explicit value for an
 *     `IDENTITY` column fails with error 544 unless preceded by
 *     `SET IDENTITY_INSERT [tbl] ON`. The SET is connection-scoped, so it
 *     must run in the same SQL batch as the `INSERT`.
 *
 *  3. **2100-parameter cap** — any statement that binds more than 2100
 *     parameters is rejected.
 *
 * Build a single multi-statement SQL batch per chunk so the whole sequence
 * (`SET ON` → `INSERT … OUTPUT … INTO @t` → `SET OFF` → `SELECT FROM @t`)
 * runs on one connection regardless of whether execution goes through
 * knex's local pool or the EE sql-executor proxy via `runExternal`.
 */

const MSSQL_PARAM_LIMIT = 2000; // 100-param buffer below the 2100 hard cap

export function mssqlChunkSize(
  rows: Record<string, any>[],
  requested: number,
): number {
  if (!rows.length) return requested;
  const paramsPerRow = Object.keys(rows[0]).length || 1;
  return Math.max(
    1,
    Math.min(requested, Math.floor(MSSQL_PARAM_LIMIT / paramsPerRow)),
  );
}

export function mssqlNeedsIdentityInsert(
  rows: Record<string, any>[],
  aiPkCol?: Column,
): boolean {
  if (!aiPkCol) return false;
  return rows.some(
    (r) =>
      r[aiPkCol.column_name] !== undefined && r[aiPkCol.column_name] !== null,
  );
}

/**
 * Detect enabled triggers via `sys.triggers`. Routed through
 * `baseModel.execAndParse` so external sources hit the remote sql-executor —
 * direct `dbDriver.raw` on an external dbDriver would target the wrong
 * database or fail outright. Caller caches across calls if needed.
 */
export async function mssqlTableHasTriggers(
  baseModel: IBaseModelSqlV2,
): Promise<boolean> {
  try {
    const knex = baseModel.dbDriver;
    const tnPath = baseModel.tnPath;
    // OBJECT_ID expects a string literal — render Raw via toQuery() and
    // strip identifier brackets so the value passes as a plain table name.
    const tnString =
      typeof tnPath === 'string'
        ? tnPath
        : tnPath.toQuery().replace(/^\[|\]$/g, '');
    const sql = knex
      .raw(
        `SELECT 1 AS x FROM sys.triggers WHERE parent_id = OBJECT_ID(?) AND is_disabled = 0`,
        [tnString],
      )
      .toQuery();
    const result: any = await baseModel.execAndParse(sql, null, { raw: true });
    const rows: any[] = Array.isArray(result)
      ? result
      : result?.rows ?? result?.recordset ?? [];
    return (rows?.length ?? 0) > 0;
  } catch {
    // On permission / transient errors, assume no triggers. The standard
    // OUTPUT path surfaces a clear error via the mssql extractor if we
    // got it wrong.
    return false;
  }
}

/**
 * Bulk INSERT batch that captures PKs via `OUTPUT … INTO @table` and
 * `SELECT`s them at the end. The one pattern safe for all MSSQL
 * constraints simultaneously: trigger tables, `IDENTITY_INSERT`, and
 * (when combined with `mssqlChunkSize`) the 2100-param cap. Preserves
 * batched perf — single multi-row `INSERT`, not per-row.
 *
 * `sql_variant`-typed table variable avoids per-column T-SQL type
 * introspection — accepts any scalar.
 *
 * Returns one row per inserted row, in insertion order.
 */
export function mssqlBuildBulkInsertWithCapture(args: {
  knex: Knex;
  tnPath: string | Knex.Raw<any>;
  rows: Record<string, any>[];
  pkCols: Column[];
  explicitIdentity: boolean;
  /**
   * Field on each PK column to use as the result-row key. Bulk paths use
   * `'title'` (matches `.returning('col as title')`); single-row paths use
   * `'id'`. Default: `'title'`.
   */
  aliasField?: 'title' | 'id' | 'column_name';
}): string {
  const {
    knex,
    tnPath,
    rows,
    pkCols,
    explicitIdentity,
    aliasField = 'title',
  } = args;
  const tnSql = knex.raw('??', [tnPath]).toQuery();
  const insertSql = knex(tnPath as any)
    .insert(rows)
    .toQuery();

  const outputCols = pkCols
    .map((c) => `INSERTED.${knex.raw('??', [c.column_name]).toQuery()}`)
    .join(', ');
  const tblVarCols = pkCols
    .map((c) => `${knex.raw('??', [c.column_name]).toQuery()} sql_variant`)
    .join(', ');
  const selectCols = pkCols
    .map(
      (c) =>
        `${knex.raw('??', [c.column_name]).toQuery()} AS ${knex
          .raw('??', [c[aliasField]])
          .toQuery()}`,
    )
    .join(', ');

  // Inject OUTPUT between the column list and VALUES. Anchored on
  // `) values` to avoid false positives on `[…]` identifier brackets
  // that may appear inside string literals.
  const insertWithOutput = insertSql.replace(
    /\)\s+values\s+/i,
    `) OUTPUT ${outputCols} INTO @nc_pks VALUES `,
  );

  const parts: string[] = [];
  if (explicitIdentity) parts.push(`SET IDENTITY_INSERT ${tnSql} ON;`);
  parts.push(`DECLARE @nc_pks TABLE (${tblVarCols});`);
  parts.push(`${insertWithOutput};`);
  if (explicitIdentity) parts.push(`SET IDENTITY_INSERT ${tnSql} OFF;`);
  parts.push(`SELECT ${selectCols} FROM @nc_pks;`);

  return parts.join('\n');
}
