import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column } from '~/models';

/**
 * CE stubs — the real MSSQL insert-SQL helpers are EE-only
 * (`src/ee/db/BaseModelSqlv2/mssql-insert-sql.ts`). MSSQL sources cannot be
 * created in the CE build (`MssqlClient` lives in `ee/`), so `baseModel.isMssql`
 * is always false here.
 *
 * The shared bulk-insert path calls some of these unconditionally (e.g.
 * `mssqlNeedsIdentityInsert` runs for every dialect with a `null` identity
 * column), so the CE versions return the same benign non-MSSQL defaults the
 * real functions produce when there's no MSSQL work — never throw on the shared
 * path. Only `mssqlBuildBulkInsertWithCapture` (invoked strictly behind
 * `isMssql` guards, and with no valid non-MSSQL output) throws if reached.
 */

const EE_ONLY = 'MSSQL is only available in the enterprise (EE) build';

export function mssqlChunkSize(
  _rows: Record<string, any>[],
  requested: number,
): number {
  // No T-SQL 2100-param cap on other dialects — use the requested size as-is.
  return requested;
}

export function mssqlNeedsIdentityInsert(
  _rows: Record<string, any>[],
  _identityColumnName: string | null | undefined,
): boolean {
  // Non-MSSQL dialects have no IDENTITY_INSERT concept.
  return false;
}

export async function mssqlTableHasTriggers(
  _baseModel: IBaseModelSqlV2,
): Promise<boolean> {
  // MSSQL-only `sys.triggers` detection — irrelevant on other dialects.
  return false;
}

export function mssqlBuildBulkInsertWithCapture(_args: {
  knex: Knex;
  tnPath: string | Knex.Raw<any>;
  rows: Record<string, any>[];
  pkCols: Column[];
  explicitIdentity: boolean;
  aliasField?: 'title' | 'id' | 'column_name';
}): string {
  throw new Error(EE_ONLY);
}
