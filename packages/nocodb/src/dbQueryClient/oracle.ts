import { ClientType } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { XKnex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { DBQueryClient } from '~/dbQueryClient/types';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';

export class OracleDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  private static readonly EE_ONLY =
    'Oracle is only available in the enterprise (EE) build';

  get clientType(): ClientType {
    return ClientType.ORACLE;
  }

  concat(_fields: string[]): string {
    throw new Error(OracleDBQueryClient.EE_ONLY);
  }

  simpleCast(_field: string, _asType: string): string {
    throw new Error(OracleDBQueryClient.EE_ONLY);
  }

  batchUpdate(_payload: {
    knex: XKnex;
    tnPath: string | Knex.Raw;
    rows: Record<string, any>[];
    pkColumnName: string;
  }): Knex.QueryBuilder | Knex.Raw | null {
    throw new Error(OracleDBQueryClient.EE_ONLY);
  }

  bulkAggregateRowSelector(
    _baseModel: IBaseModelSqlV2,
    _tQb: Knex.QueryBuilder,
    _expressions: Record<string, string>,
    _alias: string,
  ): Knex.Raw {
    throw new Error(OracleDBQueryClient.EE_ONLY);
  }
}
