import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column } from '~/models';

/**
 * MSSQL insert SQL helpers. Three T-SQL quirks drive the shape:
 *   1. Triggers reject `OUTPUT INSERTED.*` (knex's default) — need
 *      `OUTPUT INSERTED.<col> INTO @table`.
 *   2. `SET IDENTITY_INSERT` is connection-scoped — must run in the same
 *      batch as the INSERT that uses it.
 *   3. Any statement binding > 2100 parameters is rejected.
 * Build one multi-statement batch per chunk so the whole sequence runs on
 * one connection regardless of whether it goes through knex's local pool
 * or the EE sql-executor proxy.
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

/**
 * `SET IDENTITY_INSERT` needed iff a row supplies an explicit value for the
 * IDENTITY column. Pass the column *name* resolved from the model
 * (`model.columns.find(c => c.ai)?.column_name`) — `columns`, not
 * `primaryKeys`, because MSSQL allows a non-PK IDENTITY column.
 */
export function mssqlNeedsIdentityInsert(
  rows: Record<string, any>[],
  identityColumnName: string | null | undefined,
): boolean {
  if (!identityColumnName) return false;
  return rows.some(
    (r) =>
      r[identityColumnName] !== undefined && r[identityColumnName] !== null,
  );
}

/**
 * Trigger detection via `sys.triggers`. Routed through `execAndParse` so
 * external sources hit the remote sql-executor instead of `dbDriver.raw`
 * (which would target the wrong DB). Returns false on permission /
 * transient errors — the INSERT below surfaces the real error if so.
 */
export async function mssqlTableHasTriggers(
  baseModel: IBaseModelSqlV2,
): Promise<boolean> {
  try {
    const knex = baseModel.dbDriver;
    const tnPath = baseModel.tnPath;
    // OBJECT_ID expects a bare string — strip identifier brackets.
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
    return false;
  }
}

/**
 * JS string → T-SQL Unicode literal that round-trips arbitrary content.
 *   - `N'…'`: bare `'…'` enters as varchar under SQL_Latin1_General_CP1_CI_AS;
 *     anything outside Latin-1 (emoji, supplementary CJK) is lost on the
 *     implicit varchar→nvarchar conversion before the column sees it.
 *   - `CAST(… AS NVARCHAR(MAX))`: `N'…'` is implicitly `nvarchar(L)` with
 *     L capped at 4000; strings longer than 4000 chars silently truncate.
 *     Unconditional CAST avoids that cliff (cheaper than length-branching).
 *   - Drop `\x00`: tedious treats embedded NULs as token boundaries on some
 *     packet sizes, truncating or rejecting the batch.
 *   - Replace lone surrogates with U+FFFD: keeps the UTF-16 well-formed
 *     so tedious's connection encoding doesn't reject the batch.
 *   - Double single quotes: the only literal-escape T-SQL needs.
 */
function tsqlNVarcharLiteral(v: string): string {
  const safe = v
    .replace(/\x00/g, '')
    .replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      '�',
    )
    .replace(/'/g, "''");
  return `CAST(N'${safe}' AS NVARCHAR(MAX))`;
}

/**
 * Bulk INSERT batch that captures PKs via `OUTPUT … INTO @nc_pks` and
 * SELECTs them back in insertion order. Safe across all three quirks
 * above simultaneously.
 *
 * Result ordering: T-SQL doesn't promise OUTPUT order in general, but
 * `INSERT … VALUES` always gets a serial plan (parallel insert only
 * applies to `INSERT … SELECT`), so OUTPUT fires in row-tuple order.
 * The `__nc_idx IDENTITY` column on `@nc_pks` records that order;
 * `ORDER BY __nc_idx` reads it back. Callers in `insert.ts` align input
 * rows to results by array position and depend on this.
 *
 * `sql_variant` PK columns avoid per-column type introspection; tedious
 * unwraps to native JS types on the way back.
 *
 * Throws on empty `rows` or `pkCols` — both produce malformed T-SQL and
 * indicate caller logic errors.
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

  if (!rows.length) {
    throw new Error('mssqlBuildBulkInsertWithCapture: rows must be non-empty');
  }
  if (!pkCols.length) {
    throw new Error(
      'mssqlBuildBulkInsertWithCapture: pkCols must be non-empty — callers ' +
        'without a PK should use the standard batchInsert path',
    );
  }

  const tnSql = knex.raw('??', [tnPath]).toQuery();

  // Hoist per-PK identifier — used in OUTPUT, @nc_pks declaration,
  // OUTPUT INTO column list, and final SELECT.
  const pkColIdents = pkCols.map((c) =>
    knex.raw('??', [c.column_name]).toQuery(),
  );

  const escapeRow = (row: Record<string, any>) => {
    const out: Record<string, any> = {};
    for (const k in row) {
      const v = row[k];
      out[k] = typeof v === 'string' ? knex.raw(tsqlNVarcharLiteral(v)) : v;
    }
    return out;
  };
  const insertSql = knex(tnPath as any)
    .insert(rows.map(escapeRow))
    .toQuery();

  const outputCols = pkColIdents.map((id) => `INSERTED.${id}`).join(', ');
  const outputIntoCols = pkColIdents.join(', ');
  // PRIMARY KEY on the IDENTITY column makes `ORDER BY __nc_idx` a no-op
  // (table variable is already in clustered order).
  const tblVarCols = [
    '__nc_idx int IDENTITY(0,1) PRIMARY KEY',
    ...pkColIdents.map((id) => `${id} sql_variant`),
  ].join(', ');
  const selectCols = pkCols
    .map(
      (c, i) =>
        `${pkColIdents[i]} AS ${knex.raw('??', [c[aliasField]]).toQuery()}`,
    )
    .join(', ');

  // Inject `OUTPUT … INTO @nc_pks` between the column list and VALUES.
  // `.replace` without `/g` only mutates the FIRST match — that's always
  // the column-list/VALUES boundary knex emits, before any user data.
  // String literals are wrapped as `CAST(N'…' AS …)` so they can't start
  // with `)`. Safe even if a user value contains the substring later.
  const insertWithOutput = insertSql.replace(
    /\)\s+values\s+/i,
    `) OUTPUT ${outputCols} INTO @nc_pks(${outputIntoCols}) VALUES `,
  );

  const parts: string[] = [];
  if (explicitIdentity) parts.push(`SET IDENTITY_INSERT ${tnSql} ON;`);
  parts.push(`DECLARE @nc_pks TABLE (${tblVarCols});`);
  parts.push(`${insertWithOutput};`);
  if (explicitIdentity) parts.push(`SET IDENTITY_INSERT ${tnSql} OFF;`);
  parts.push(`SELECT ${selectCols} FROM @nc_pks ORDER BY __nc_idx;`);

  return parts.join('\n');
}
