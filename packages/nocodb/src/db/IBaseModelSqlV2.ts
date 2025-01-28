import type { NcApiVersion, NcContext } from 'nocodb-sdk';
import type { Column, Model } from 'src/models';
import type { Knex } from 'knex';
import type CustomKnex from './CustomKnex';

export interface IBaseModelSqlV2 {
  context: NcContext;
  model: Model;

  get dbDriver(): CustomKnex;

  execAndParse(
    qb: Knex.QueryBuilder | string,
    dependencyColumns?: Column[],
    options?: {
      skipDateConversion?: boolean;
      skipAttachmentConversion?: boolean;
      skipSubstitutingColumnIds?: boolean;
      skipUserConversion?: boolean;
      skipJsonConversion?: boolean;
      raw?: boolean; // alias for skipDateConversion and skipAttachmentConversion
      first?: boolean;
      bulkAggregate?: boolean;
      apiVersion?: NcApiVersion;
    },
  ): Promise<any>;
}
