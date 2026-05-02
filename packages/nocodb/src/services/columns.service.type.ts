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

/**
 * IDs created by `createHmAndBtColumn` / `createOOColumn`. Used for both
 * `idHints` (replay reads) and `out` (recording writes) in `columnHelpers`.
 */
export interface LtarHmBtIds {
  childRelColId?: string;
  savedColumnId?: string;
}

/**
 * Side-effect IDs created by `createLTARColumn`. Captured into
 * `param._ltarCapture` during recording (surfaced via `extraCommandMeta`
 * on `ColumnAddContract`) and read back as `param._ltarReplayIds` on
 * replay so each insert site honors the recorded id. The savedColumn
 * itself uses `idField: 'column'` and isn't in this shape.
 */
export interface LtarSideEffectIds {
  /** FK column on `refTable` for hm/bt + oo paths. */
  fkColumnId?: string;
  /** Hidden mm junction model (mm path only). */
  assocModelId?: string;
  /**
   * Auto-created default grid view on the assoc model. Threaded into
   * `Model.insert` via `_sandboxDefaultViewId` so the production-side
   * view keeps the sandbox-side id.
   */
  assocDefaultViewId?: string;
  /** Reverse LTAR column on `refTable`. */
  reverseColumnId?: string;
  /** FK columns on the assoc table (mm path) — pre-set on `associateTableCols` so `Column.bulkInsert` honors them. */
  assocChildColId?: string;
  assocParentColId?: string;
  /** Two `createHmAndBtColumn` calls for mm — assoc→ref and assoc→table. */
  hmBtCallRef?: LtarHmBtIds;
  hmBtCallTable?: LtarHmBtIds;
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
