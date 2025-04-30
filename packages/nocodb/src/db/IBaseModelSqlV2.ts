import type BigNumber from 'bignumber.js';
import type {
  XcFilter,
  XcFilterWithAlias,
} from './sql-data-mapper/lib/BaseModel';
import type { XKnex } from '~/db/CustomKnex';
import type {
  AuditV1OperationTypes,
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

  prepareNocoData(
    data,
    isInsertData,
    cookie?: { user?: any; system?: boolean },
    // oldData uses title as key whereas data uses column_name as key
    oldData?,
    extra?: {
      raw?: boolean;
      ncOrder?: BigNumber;
      before?: string;
      undo?: boolean;
    },
  ): Promise<void>;

  extractCompositePK({
    ai,
    ag,
    rowId,
    insertObj,
    force,
  }: {
    ai: Column<any>;
    ag: Column<any>;
    rowId;
    insertObj: Record<string, any>;
    force?: boolean;
  }): any;

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
  readByPk(
    id?: any,
    validateFormula?: boolean,
    query?: any,
    param?: {
      ignoreView?: boolean;
      getHiddenColumn?: boolean;
      throwErrorIfInvalidParams?: boolean;
      extractOnlyPrimaries?: boolean;
      apiVersion?: NcApiVersion;
      extractOrderColumn?: boolean;
    },
  ): Promise<any>;

  getViewId(): string;

  getTnPath(
    tb:
      | {
          table_name: string;
        }
      | string,
    alias?: string,
  ): string | Knex.Raw<any>;

  beforeInsert(
    data: any,
    _trx: any,
    req,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void>;
  beforeUpdate(data: any, _trx: any, req): Promise<void>;
  beforeBulkInsert(
    data: any,
    _trx: any,
    req,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void>;

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

  afterRemoveChild({
    columnTitle,
    columnId,
    rowId,
    refRowId,
    req,
    model,
    refModel,
    displayValue,
    refDisplayValue,
    type,
  }: {
    columnTitle: string;
    columnId: string;
    refColumnTitle: string;
    rowId: unknown;
    refRowId: unknown;
    req: NcRequest;
    model: Model;
    refModel: Model;
    displayValue: unknown;
    refDisplayValue: unknown;
    type: RelationTypes;
  }): Promise<void>;

  afterInsert({
    data,
    insertData,
    trx,
    req,
  }: {
    data: any;
    insertData: any;
    trx: any;
    req: NcRequest;
  }): Promise<void>;

  afterUpdate(
    prevData: any,
    newData: any,
    _trx: any,
    req,
    updateObj?: Record<string, any>,
  ): Promise<void>;

  afterBulkInsert(data: any[], _trx: any, req): Promise<void>;

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
  getHighestOrderInTable(): Promise<BigNumber>;

  shuffle({ qb }: { qb: Knex.QueryBuilder }): Promise<void>;
  getSelectQueryBuilderForFormula(
    column: Column<any>,
    tableAlias?: string,
    validateFormula?: boolean,
    aliasToColumnBuilder?: any,
  ): Promise<any>;

  errorInsert(_e, _data, _trx, _cookie): void | Promise<void>;
  errorUpdate(_e, _data, _trx, _cookie): void | Promise<void>;

  prepareNestedLinkQb(param: {
    nestedCols: Column[];
    data: Record<string, any>;
    insertObj: Record<string, any>;
    req: NcRequest;
  }): Promise<{
    postInsertOps: ((rowId: any) => Promise<string>)[];
    preInsertOps: (() => Promise<string>)[];
    postInsertAuditOps: ((rowId: any) => Promise<void>)[];
  }>;

  handleValidateBulkInsert(
    d: Record<string, any>,
    columns?: Column[],
    params?: {
      allowSystemColumn: boolean;
      undo: boolean;
      typecast: boolean;
    },
  ): Promise<any>;

  validate(
    data: Record<string, any>,
    columns?: Column[],
    {
      typecast,
      allowSystemColumn,
    }?: { typecast?: boolean; allowSystemColumn?: boolean },
  ): Promise<boolean>;

  runOps(ops: Promise<string>[], trx?: CustomKnex): Promise<void>;
  statsUpdate(_args: { count: number }): Promise<void | any>;
  afterAddOrRemoveChild(
    commonAuditObj: {
      opType: AuditV1OperationTypes;
      model: Model;
      refModel: Model;
      columnTitle: string;
      columnId: string;
      refColumnTitle: string;
      refColumnId: string;
      req: NcRequest;
    },
    auditObjs: Array<{
      rowId: unknown;
      refRowId: unknown;
      displayValue?: unknown;
      refDisplayValue?: unknown;
      type: RelationTypes;
    }>,
  ): Promise<void>;

  get viewId(): string;
  get dbDriver(): CustomKnex;
  get isSqlite(): boolean;
  get isMssql(): boolean;
  get isPg(): boolean;
  get isMySQL(): boolean;
  get isSnowflake(): boolean;
  get isDatabricks(): boolean;
  get clientType(): string;
  get clientMeta(): {
    isSqlite: boolean;
    isMssql: boolean;
    isPg: boolean;
    isMySQL: boolean;
  };
}
