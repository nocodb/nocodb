import type {
  ColumnReqType,
  NcApiVersion,
  NcContext,
  NcRequest,
  UserType,
} from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type CustomKnex from '~/db/CustomKnex';
import type SqlClient from '~/db/sql-client/lib/SqlClient';
import type SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import type { MetaService } from '~/meta/meta.service';
import type { Base, Column, Model, Source } from '~/models';

export interface ReusableParams {
  table?: Model;
  source?: Source;
  base?: Base;
  dbDriver?: CustomKnex;
  sqlClient?: SqlClient;
  sqlMgr?: SqlMgrv2;
  baseModel?: BaseModelSqlv2;
}

export interface IColumnsService {
  columnAdd<T extends NcApiVersion = NcApiVersion | null | undefined>(
    context: NcContext,
    param: {
      req: NcRequest;
      tableId: string;
      column: ColumnReqType;
      user: UserType;
      reuse?: ReusableParams;
      suppressFormulaError?: boolean;
      apiVersion?: T;
    },
  ): Promise<T extends NcApiVersion.V3 ? Column : Model>;

  columnUpdate(
    context: NcContext,
    param: {
      req: NcRequest;
      columnId: string;
      column: ColumnReqType & { colOptions?: any };
      user: UserType;
      reuse?: ReusableParams;
      apiVersion?: NcApiVersion;
    },
  ): Promise<Model | Column<any>>;

  columnDelete(
    context: NcContext,
    param: {
      req?: any;
      columnId: string;
      user: UserType;
      forceDeleteSystem?: boolean;
      reuse?: ReusableParams;
    },
    ncMeta?: MetaService,
  ): Promise<Model>;
}
