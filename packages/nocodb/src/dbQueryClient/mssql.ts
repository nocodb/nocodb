import { ClientType } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type {
  AggregationGeneratorParams,
  DBQueryClient,
} from '~/dbQueryClient/types';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';

export class MssqlDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  private static readonly EE_ONLY =
    'MSSQL is only available in the enterprise (EE) build';

  get clientType(): ClientType {
    return ClientType.MSSQL;
  }

  concat(_fields: string[]): string {
    throw new Error(MssqlDBQueryClient.EE_ONLY);
  }

  simpleCast(_field: string, _asType: string): string {
    throw new Error(MssqlDBQueryClient.EE_ONLY);
  }

  generateAggregateQuery(_params: AggregationGeneratorParams): string {
    throw new Error(MssqlDBQueryClient.EE_ONLY);
  }

  bulkAggregateRowSelector(
    _baseModel: IBaseModelSqlV2,
    _tQb: Knex.QueryBuilder,
    _expressions: Record<string, string>,
    _alias: string,
  ): Knex.Raw {
    throw new Error(MssqlDBQueryClient.EE_ONLY);
  }
}
