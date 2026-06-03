import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column } from '~/models';

const EE_ONLY = 'MSSQL is only available in the enterprise (EE) build';

export function mssqlChunkSize(
  _rows: Record<string, any>[],
  _requested: number,
): number {
  throw new Error(EE_ONLY);
}

export function mssqlNeedsIdentityInsert(
  _rows: Record<string, any>[],
  _identityColumnName: string | null | undefined,
): boolean {
  throw new Error(EE_ONLY);
}

export async function mssqlTableHasTriggers(
  _baseModel: IBaseModelSqlV2,
): Promise<boolean> {
  throw new Error(EE_ONLY);
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
