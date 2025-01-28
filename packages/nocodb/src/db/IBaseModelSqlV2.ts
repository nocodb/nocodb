import type { XKnex } from '~/db/CustomKnex';
import type { NcApiVersion, NcContext } from 'nocodb-sdk';
import type { Column, Model } from '~/models';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';

export interface IBaseModelSqlV2 {
  context: NcContext;
  model: Model;
  tnPath: string | Knex.Raw<any>;

  readByPk(
    id: undefined | any,
    validateFormula: boolean,
    query: any,
    options: {
      ignoreView?: boolean;
      getHiddenColumn?: boolean;
      throwErrorIfInvalidParams?: boolean;
      extractOnlyPrimaries?: boolean;
      apiVersion?: NcApiVersion;
      extractOrderColumn?: boolean;
    },
  ): Promise<any>;
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

  updateLastModified(payload: {
    rowIds: any | any[];
    cookie?: { user?: any };
    model?: Model;
    knex?: XKnex;
    baseModel?: IBaseModelSqlV2;
  }): Promise<void>;
  readOnlyPrimariesByPkFromModel(
    props: { model: Model; id: any; extractDisplayValueData?: boolean }[],
  ): Promise<any[]>;
  extractPksValues(data: any, asString?: boolean): any;

  getViewId(): string;

  get dbDriver(): CustomKnex;
  get isSqlite(): boolean;
  get isMssql(): boolean;
  get isPg(): boolean;
  get isMySQL(): boolean;
  get isSnowflake(): boolean;
  get isDatabricks(): boolean;
  get clientType(): string;
}
