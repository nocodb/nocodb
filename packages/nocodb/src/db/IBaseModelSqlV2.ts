import type {
  XcFilter,
  XcFilterWithAlias,
} from './sql-data-mapper/lib/BaseModel';
import type { XKnex } from '~/db/CustomKnex';
import type {
  NcApiVersion,
  NcContext,
  NcRequest,
  RelationTypes,
} from 'nocodb-sdk';
import type { Column, Model, View } from '~/models';
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

  getTnPath(
    tb:
      | {
          table_name: string;
        }
      | string,
    alias?: string,
  ): string | Knex.Raw<any>;

  afterAddChild(props: {
    columnTitle: string;
    columnId: string;
    refColumnTitle: string;
    rowId: unknown;
    refRowId: unknown;
    req: NcRequest;
    model?: Model;
    refModel?: Model;
    displayValue: unknown;
    refDisplayValue: unknown;
    type: RelationTypes;
  }): Promise<void>;

  applySortAndFilter(param: {
    table: Model;
    view?: View;
    where: string;
    qb;
    sort: string;
    onlySort?: boolean;
    skipViewFilter?: boolean;
  }): Promise<void>;

  _getListArgs(
    args: XcFilterWithAlias,
    options?: {
      apiVersion?: NcApiVersion;
      nested?: boolean;
    },
  ): XcFilter;

  getCustomConditionsAndApply(params: {
    view?: View;
    column: Column<any>;
    qb?;
    filters?;
    args;
    rowId;
    columns?: Column[];
  }): Promise<any>;

  get dbDriver(): CustomKnex;
  get isSqlite(): boolean;
  get isMssql(): boolean;
  get isPg(): boolean;
  get isMySQL(): boolean;
  get isSnowflake(): boolean;
  get isDatabricks(): boolean;
  get clientType(): string;
}
