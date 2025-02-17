import {
  isLinksOrLTAR,
  isVirtualCol,
  ModelTypes,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import dayjs from 'dayjs';
import { Logger } from '@nestjs/common';
import hash from 'object-hash';
import type { NcRequest } from 'nocodb-sdk';
import type { BoolType, TableReqType, TableType } from 'nocodb-sdk';
import type { XKnex } from '~/db/CustomKnex';
import type { LinksColumn, LinkToAnotherRecordColumn } from '~/models/index';
import type { NcContext } from '~/interface/config';
import Hook from '~/models/Hook';
import View from '~/models/View';
import Comment from '~/models/Comment';
import Column from '~/models/Column';
import { extractProps } from '~/helpers/extractProps';
import { sanitize } from '~/helpers/sqlSanitize';
import { NcError } from '~/helpers/catchError';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { FileReference } from '~/models';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
} from '~/utils/modelUtils';
import { Source } from '~/models';

const logger = new Logger('Model');

export default class Model implements TableType {
  copy_enabled: BoolType;
  source_id: 'db' | string;
  deleted: BoolType;
  enabled: BoolType;
  export_enabled: BoolType;
  id: string;
  order: number;
  parent_id: string;
  password: string;
  pin: BoolType;
  fk_workspace_id?: string;
  base_id: string;
  schema: any;
  show_all_fields: boolean;
  tags: string;
  type: ModelTypes;

  table_name: string;
  title: string;
  description?: string;

  mm: BoolType;

  uuid: string;

  columns?: Column[];
  columnsById?: { [id: string]: Column };
  columnsHash?: string;
  views?: View[];
  meta?: Record<string, any> | string;

  constructor(data: Partial<TableType | Model>) {
    Object.assign(this, data);
  }

  public async getColumns(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    defaultViewId = undefined,
  ): Promise<Column[]> {
    this.columns = await Column.list(
      context,
      {
        fk_model_id: this.id,
        fk_default_view_id: defaultViewId,
      },
      ncMeta,
    );

    this.columnsById = this.columns.reduce((agg, c) => {
      agg[c.id] = c;
      return agg;
    }, {});

    return this.columns;
  }

  public async getColumnsHash(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    updateColumns = false,
  ): Promise<string> {
    const columns = await this.getColumns(context, ncMeta);

    if (updateColumns) {
      this.columns = columns;
    }

    return (this.columnsHash = hash(columns));
  }

  // get columns cached under the instance or fetch from db/redis cache
  public async getCachedColumns(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Column[]> {
    if (this.columns) return this.columns;
    return this.getColumns(context, ncMeta);
  }

  // @ts-ignore
  public async getViews(
    context: NcContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    force = false,
    ncMeta = Noco.ncMeta,
  ): Promise<View[]> {
    this.views = await View.listWithInfo(context, this.id, ncMeta);
    return this.views;
  }

  public get primaryKey(): Column {
    if (!this.columns) return null;
    //  return first auto increment or augto generated column
    // if not found return first pk column
    return (
      this.columns.find((c) => c.pk && (c.ai || c.meta?.ag)) ||
      this.columns?.find((c) => c.pk)
    );
  }

  public get primaryKeys(): Column[] {
    if (!this.columns) return null;
    return this.columns?.filter((c) => c.pk);
  }

  // If there is no column marked as display value,
  // we are getting the immediate next column to pk as display value
  // or the first column(if pk is the last column).
  public get displayValue(): Column {
    if (!this.columns) return null;
    const pCol = this.columns?.find((c) => c.pv);
    if (pCol) return pCol;
    if (this.mm) {
      // by default, there is no default value in m2m table
      // take the first column instead
      return this.columns[0];
    }
    const pkIndex = this.columns.indexOf(this.primaryKey);
    if (pkIndex < this.columns.length - 1) return this.columns[pkIndex + 1];
    return this.columns[0];
  }

  public static async insert(
    context: NcContext,
    baseId,
    sourceId,
    model: Partial<TableReqType> & {
      mm?: BoolType;
      type?: ModelTypes;
      source_id?: string;
      user_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(model, [
      'table_name',
      'title',
      'description',
      'mm',
      'order',
      'type',
      'id',
      'meta',
    ]);

    insertObj.mm = !!insertObj.mm;

    if (!insertObj.order) {
      insertObj.order = await ncMeta.metaGetNextOrder(
        MetaTable.FORM_VIEW_COLUMNS,
        {
          base_id: baseId,
          source_id: sourceId,
        },
      );
    }

    if (!insertObj.type) {
      insertObj.type = ModelTypes.TABLE;
    }

    insertObj.source_id = sourceId;

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      insertObj,
    );

    const insertedColumns = await Column.bulkInsert(
      context,
      {
        columns: (model?.columns || []) as Column[],
        fk_model_id: id,
        source_id: sourceId,
        base_id: baseId,
      },
      ncMeta,
    );

    await View.insertMetaOnly(
      context,
      {
        view: {
          fk_model_id: id,
          title: model.title || model.table_name,
          is_default: true,
          type: ViewTypes.GRID,
          base_id: baseId,
          source_id: sourceId,
          created_by: model.user_id,
          owned_by: model.user_id,
        },
        model: {
          getColumns: async () => insertedColumns,
        },
        req: { user: {} } as unknown as NcRequest,
      },
      ncMeta,
    );

    const modelRes = await this.getWithInfo(context, { id }, ncMeta);

    // append to model list since model list cache will be there already
    if (sourceId) {
      await NocoCache.appendToList(
        CacheScope.MODEL,
        [baseId, sourceId],
        `${CacheScope.MODEL}:${id}`,
      );
    }
    // cater cases where sourceId is not required
    // e.g. xcVisibilityMetaGet
    await NocoCache.appendToList(
      CacheScope.MODEL,
      [baseId],
      `${CacheScope.MODEL}:${id}`,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return modelRes;
  }

  public static async list(
    context: NcContext,
    {
      base_id,
      source_id,
    }: {
      base_id: string;
      source_id: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model[]> {
    const cachedList = await NocoCache.getList(CacheScope.MODEL, [
      base_id,
      source_id,
    ]);
    let { list: modelList } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !modelList.length) {
      modelList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        {
          orderBy: {
            order: 'asc',
          },
          ...(source_id ? { condition: { source_id } } : {}),
        },
      );

      // parse meta of each model
      for (const model of modelList) {
        model.meta = parseMetaProp(model);
      }

      // set cache based on source_id presence
      if (source_id) {
        await NocoCache.setList(
          CacheScope.MODEL,
          [base_id, source_id],
          modelList,
        );
      } else {
        await NocoCache.setList(CacheScope.MODEL, [base_id], modelList);
      }
    }
    modelList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );

    for (const model of modelList) {
      if (model.meta?.hasNonDefaultViews === undefined) {
        model.meta = {
          ...(model.meta ?? {}),
          hasNonDefaultViews: await Model.getNonDefaultViewsCountAndReset(
            context,
            { modelId: model.id },
            ncMeta,
          ),
        };
      }
    }

    return modelList.map((m) => new Model(m));
  }

  public static async listWithInfo(
    context: NcContext,
    {
      base_id,
      db_alias,
    }: {
      base_id: string;
      db_alias: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model[]> {
    const cachedList = await NocoCache.getList(CacheScope.MODEL, [
      base_id,
      db_alias,
    ]);
    let { list: modelList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !modelList.length) {
      modelList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
      );

      // parse meta of each model
      for (const model of modelList) {
        model.meta = parseMetaProp(model);
      }

      await NocoCache.setList(CacheScope.MODEL, [base_id], modelList);
    }

    for (const model of modelList) {
      if (model.meta?.hasNonDefaultViews === undefined) {
        model.meta = {
          ...(model.meta ?? {}),
          hasNonDefaultViews: await Model.getNonDefaultViewsCountAndReset(
            context,
            { modelId: model.id },
            ncMeta,
          ),
        };
      }
    }

    return modelList.map((m) => new Model(m));
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    let modelData =
      id &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!modelData) {
      modelData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        id,
      );

      if (modelData) {
        modelData.meta = parseMetaProp(modelData);
        await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      }
    }
    return modelData && new Model(modelData);
  }

  public static async getByIdOrName(
    context: NcContext,
    args:
      | {
          base_id: string;
          source_id: string;
          table_name: string;
        }
      | {
          id?: string;
        },
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    const k = 'id' in args ? args?.id : args;
    let modelData =
      k &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${k}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!modelData) {
      modelData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        k,
      );
      if (modelData) {
        modelData.meta = parseMetaProp(modelData);
      }
    }
    if (modelData) {
      modelData.meta = parseMetaProp(modelData);
      await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      return new Model(modelData);
    }
    return null;
  }

  public static async getWithInfo(
    context: NcContext,
    {
      table_name,
      id,
    }: {
      table_name?: string;
      id?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    let modelData =
      id &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!modelData) {
      modelData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        id || {
          table_name,
        },
      );
      if (modelData) {
        modelData.meta = parseMetaProp(modelData);
        await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      }
      // modelData.filters = await Filter.getFilterObject({
      //   viewId: modelData.id
      // });
      // modelData.sorts = await Sort.list({ modelId: modelData.id });
    }
    if (modelData) {
      const m = new Model(modelData);

      await m.getViews(context, false, ncMeta);

      const defaultViewId = m.views.find((view) => view.is_default).id;

      await m.getColumns(context, ncMeta, defaultViewId);

      await m.getColumnsHash(context, ncMeta);

      return m;
    }
    return null;
  }

  public static async getBaseModelSQL(
    context: NcContext,
    args: {
      id?: string;
      viewId?: string;
      dbDriver: XKnex;
      model?: Model;
      extractDefaultView?: boolean;
      source?: Source;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<BaseModelSqlv2> {
    const model = args?.model || (await this.get(context, args.id, ncMeta));
    const source =
      args.source ||
      (await Source.get(context, model.source_id, false, ncMeta));

    if (!args?.viewId && args.extractDefaultView) {
      const view = await View.getDefaultView(context, model.id, ncMeta);
      args.viewId = view.id;
    }
    let schema: string;

    if (source?.isMeta(true, 1)) {
      schema = source.getConfig()?.schema;
    } else if (source?.type === 'pg') {
      schema = source.getConfig()?.searchPath?.[0];
    }

    return new BaseModelSqlv2({
      context,
      dbDriver: args.dbDriver,
      viewId: args.viewId,
      model,
      schema,
    });
  }

  async delete(
    context: NcContext,
    ncMeta = Noco.ncMeta,
    force = false,
  ): Promise<boolean> {
    await Comment.deleteModelComments(context, this.id, ncMeta);

    for (const view of await this.getViews(context, true, ncMeta)) {
      await view.delete(context, ncMeta);
    }

    // delete associated hooks
    for (const hook of await Hook.list(
      context,
      { fk_model_id: this.id },
      ncMeta,
    )) {
      await Hook.delete(context, hook.id, ncMeta);
    }

    for (const col of await this.getColumns(context, ncMeta)) {
      let colOptionTableName = null;
      let cacheScopeName = null;
      switch (col.uidt) {
        case UITypes.Rollup:
          colOptionTableName = MetaTable.COL_ROLLUP;
          cacheScopeName = CacheScope.COL_ROLLUP;
          break;
        case UITypes.Lookup:
          colOptionTableName = MetaTable.COL_LOOKUP;
          cacheScopeName = CacheScope.COL_LOOKUP;
          break;
        case UITypes.ForeignKey:
        case UITypes.LinkToAnotherRecord:
          colOptionTableName = MetaTable.COL_RELATIONS;
          cacheScopeName = CacheScope.COL_RELATION;
          break;
        case UITypes.MultiSelect:
        case UITypes.SingleSelect:
          colOptionTableName = MetaTable.COL_SELECT_OPTIONS;
          cacheScopeName = CacheScope.COL_SELECT_OPTION;
          break;
        case UITypes.Formula:
          colOptionTableName = MetaTable.COL_FORMULA;
          cacheScopeName = CacheScope.COL_FORMULA;
          break;
        case UITypes.QrCode:
          colOptionTableName = MetaTable.COL_QRCODE;
          cacheScopeName = CacheScope.COL_QRCODE;
          break;
        case UITypes.Barcode:
          colOptionTableName = MetaTable.COL_BARCODE;
          cacheScopeName = CacheScope.COL_BARCODE;
          break;
      }
      if (colOptionTableName && cacheScopeName) {
        await ncMeta.metaDelete(
          context.workspace_id,
          context.base_id,
          colOptionTableName,
          {
            fk_column_id: col.id,
          },
        );
        await NocoCache.deepDel(
          `${cacheScopeName}:${col.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
    }

    if (force) {
      const leftOverColumns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_RELATIONS,
        {
          condition: {
            fk_related_model_id: this.id,
          },
        },
      );

      for (const col of leftOverColumns) {
        await NocoCache.deepDel(
          `${CacheScope.COL_RELATION}:${col.fk_column_id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }

      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_RELATIONS,
        {
          fk_related_model_id: this.id,
        },
      );
    }

    await NocoCache.deepDel(
      `${CacheScope.COLUMN}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      {
        fk_model_id: this.id,
      },
    );

    // Delete FileReference
    await FileReference.bulkDelete(context, { fk_model_id: this.id }, ncMeta);

    await NocoCache.deepDel(
      `${CacheScope.MODEL}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      this.id,
    );

    // delete alias cache
    await NocoCache.del([
      `${CacheScope.MODEL_ALIAS}:${this.base_id}:${this.id}`,
      `${CacheScope.MODEL_ALIAS}:${this.base_id}:${this.source_id}:${this.id}`,
      `${CacheScope.MODEL_ALIAS}:${this.base_id}:${this.title}`,
      `${CacheScope.MODEL_ALIAS}:${this.base_id}:${this.source_id}:${this.title}`,
    ]);

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return true;
  }

  async mapAliasToColumn(
    context: NcContext,
    data,
    clientMeta = {
      isMySQL: false,
      isSqlite: false,
      isMssql: false,
      isPg: false,
    },
    knex,
    columns?: Column[],
  ) {
    const insertObj = {};
    for (const col of columns || (await this.getColumns(context))) {
      if (isVirtualCol(col)) continue;
      let val =
        data?.[col.column_name] !== undefined
          ? data?.[col.column_name]
          : data?.[col.title];
      if (val !== undefined) {
        if (col.uidt === UITypes.Attachment && typeof val !== 'string') {
          val = JSON.stringify(val);
        }
        if (col.uidt === UITypes.DateTime && dayjs(val).isValid()) {
          const { isMySQL, isSqlite, isMssql, isPg } = clientMeta;
          if (
            val.indexOf('-') < 0 &&
            val.indexOf('+') < 0 &&
            val.slice(-1) !== 'Z'
          ) {
            // if no timezone is given,
            // then append +00:00 to make it as UTC
            val += '+00:00';
          }
          if (isMySQL) {
            // first convert the value to utc
            // from UI
            // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
            // from API
            // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
            // if timezone info is not found - considered as utc
            // e.g. 2022-01-01 20:00:00 -> 2022-01-01 20:00:00
            // if timezone info is found
            // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
            // e.g. 2022-01-01 20:00:00+00:00 -> 2022-01-01 20:00:00
            // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
            // then we use CONVERT_TZ to convert that in the db timezone
            val = knex.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
              dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
            ]);
          } else if (isSqlite) {
            // convert to UTC
            // e.g. 2022-01-01T10:00:00.000Z -> 2022-01-01 04:30:00+00:00
            val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
          } else if (isPg) {
            // convert to UTC
            // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
            // then convert to db timezone
            val = knex.raw(`? AT TIME ZONE CURRENT_SETTING('timezone')`, [
              dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ'),
            ]);
          } else if (isMssql) {
            // convert ot UTC
            // e.g. 2023-05-10T08:49:32.000Z -> 2023-05-10 08:49:32-08:00
            // then convert to db timezone
            val = knex.raw(
              `SWITCHOFFSET(CONVERT(datetimeoffset, ?), DATENAME(TzOffset, SYSDATETIMEOFFSET()))`,
              [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ')],
            );
          } else {
            // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
            val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
          }
        }
        insertObj[sanitize(col.column_name)] = val;

        if (clientMeta.isPg && col.dt === 'bytea') {
          insertObj[sanitize(col.column_name)] = knex.raw(
            `decode(?, '${col.meta?.format === 'hex' ? 'hex' : 'escape'}')`,
            [
              col.meta?.format === 'hex' && (val + '').length % 2 === 1
                ? '0' + val
                : val,
            ],
          );
        }
      }
    }
    return insertObj;
  }

  async mapColumnToAlias(context: NcContext, data, columns?: Column[]) {
    const res = {};
    for (const col of columns || (await this.getColumns(context))) {
      if (isVirtualCol(col)) continue;
      let val =
        data?.[col.title] !== undefined
          ? data?.[col.title]
          : data?.[col.column_name];
      if (val !== undefined) {
        if (col.uidt === UITypes.Attachment && typeof val !== 'string') {
          val = JSON.stringify(val);
        }
        res[sanitize(col.title)] = val;
      }
    }
    return res;
  }

  static async updateAliasAndTableName(
    context: NcContext,
    tableId,
    title: string,
    table_name: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (!title) {
      NcError.badRequest("Missing 'title' property in body");
    }
    if (!table_name) {
      NcError.badRequest("Missing 'table_name' property in body");
    }

    const oldModel = await this.get(context, tableId, ncMeta);

    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        title,
        table_name,
      },
      tableId,
    );

    // get default view and update alias
    {
      const defaultView = await View.getDefaultView(context, tableId, ncMeta);
      if (defaultView) {
        await View.update(context, defaultView.id, {
          title,
        });
      }
    }

    await NocoCache.update(`${CacheScope.MODEL}:${tableId}`, {
      title,
      table_name,
    });

    // delete alias cache
    await NocoCache.del([
      `${CacheScope.MODEL_ALIAS}:${oldModel.base_id}:${oldModel.id}`,
      `${CacheScope.MODEL_ALIAS}:${oldModel.base_id}:${oldModel.source_id}:${oldModel.id}`,
      `${CacheScope.MODEL_ALIAS}:${oldModel.base_id}:${oldModel.title}`,
      `${CacheScope.MODEL_ALIAS}:${oldModel.base_id}:${oldModel.source_id}:${oldModel.title}`,
    ]);

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    // clear all the cached query under this model
    await View.clearSingleQueryCache(context, tableId, null, ncMeta);

    // clear all the cached query under related models
    for (const col of await this.get(context, tableId).then((t) =>
      t.getColumns(context),
    )) {
      if (!isLinksOrLTAR(col)) continue;

      const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>(
        context,
        ncMeta,
      );

      if (colOptions.fk_related_model_id === tableId) continue;

      await View.clearSingleQueryCache(
        context,
        colOptions.fk_related_model_id,
        null,
        ncMeta,
      );
    }

    return res;
  }

  static async markAsMmTable(
    context: NcContext,
    tableId,
    isMm = true,
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        mm: isMm,
      },
      tableId,
    );

    await NocoCache.update(`${CacheScope.MODEL}:${tableId}`, {
      mm: isMm,
    });

    return res;
  }

  async getAliasColMapping(context: NcContext) {
    return (await this.getColumns(context)).reduce((o, c) => {
      if (c.column_name) {
        o[c.title] = c.column_name;
      }
      return o;
    }, {});
  }

  async getColAliasMapping(context: NcContext) {
    return (await this.getColumns(context)).reduce((o, c) => {
      if (c.column_name) {
        o[c.column_name] = c.title;
      }
      return o;
    }, {});
  }

  static async updateOrder(
    context: NcContext,
    tableId: string,
    order: number,
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        order,
      },
      tableId,
    );

    await NocoCache.update(`${CacheScope.MODEL}:${tableId}`, {
      order,
    });

    return res;
  }

  static async updatePrimaryColumn(
    context: NcContext,
    tableId: string,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const model = await this.getWithInfo(context, { id: tableId }, ncMeta);
    const newPvCol = model.columnsById[columnId];

    if (!newPvCol) NcError.fieldNotFound(columnId);

    // drop existing primary column/s
    for (const col of model.columns?.filter((c) => c.pv) || []) {
      // set meta
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        {
          pv: false,
        },
        col.id,
      );

      await NocoCache.update(`${CacheScope.COLUMN}:${col.id}`, {
        pv: false,
      });
    }

    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      {
        pv: true,
      },
      newPvCol.id,
    );

    await NocoCache.update(`${CacheScope.COLUMN}:${newPvCol.id}`, {
      pv: true,
    });

    const grid_views_with_column = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_column_id: newPvCol.id,
        },
      },
    );

    if (grid_views_with_column.length) {
      for (const gv of grid_views_with_column) {
        await View.fixPVColumnForView(context, gv.fk_view_id, ncMeta);
      }
    }

    // use set to avoid duplicate
    const relatedModelIds = new Set<string>();

    // clear all single query cache of related views
    for (const col of model.columns) {
      if (!isLinksOrLTAR(col)) continue;
      const colOptions = await col.getColOptions<
        LinkToAnotherRecordColumn | LinksColumn
      >(context);
      relatedModelIds.add(colOptions?.fk_related_model_id);
    }

    await Promise.all(
      Array.from(relatedModelIds).map(async (modelId: string) => {
        await View.clearSingleQueryCache(context, modelId, null, ncMeta);
      }),
    );

    return true;
  }

  static async setAsMm(context: NcContext, id: any, ncMeta = Noco.ncMeta) {
    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        mm: true,
      },
      id,
    );

    await NocoCache.update(`${CacheScope.MODEL}:${id}`, {
      mm: true,
    });
  }

  static async getByAliasOrId(
    context: NcContext,
    {
      base_id,
      source_id,
      aliasOrId,
    }: {
      base_id: string;
      source_id?: string;
      aliasOrId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cacheKey = source_id
      ? `${CacheScope.MODEL_ALIAS}:${base_id}:${source_id}:${aliasOrId}`
      : `${CacheScope.MODEL_ALIAS}:${base_id}:${aliasOrId}`;
    const modelId =
      base_id &&
      aliasOrId &&
      (await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING));
    if (!modelId) {
      const model = source_id
        ? await ncMeta.metaGet2(
            context.workspace_id,
            context.base_id,
            MetaTable.MODELS,
            { base_id, source_id },
            null,
            {
              _or: [
                {
                  id: {
                    eq: aliasOrId,
                  },
                },
                {
                  title: {
                    eq: aliasOrId,
                  },
                },
              ],
            },
          )
        : await ncMeta.metaGet2(
            context.workspace_id,
            context.base_id,
            MetaTable.MODELS,
            { base_id },
            null,
            {
              _or: [
                {
                  id: {
                    eq: aliasOrId,
                  },
                },
                {
                  title: {
                    eq: aliasOrId,
                  },
                },
              ],
            },
          );
      if (model) {
        await NocoCache.set(cacheKey, model.id);
        await NocoCache.set(`${CacheScope.MODEL}:${model.id}`, model);
      }
      return model && new Model(model);
    }
    return modelId && this.get(context, modelId);
  }

  static async checkTitleAvailable(
    context: NcContext,
    {
      table_name,
      source_id,
      exclude_id,
    }: { table_name; base_id; source_id; exclude_id? },
    ncMeta = Noco.ncMeta,
  ) {
    return !(await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        table_name,
        ...(source_id ? { source_id } : {}),
      },
      null,
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  static async checkAliasAvailable(
    context: NcContext,
    {
      title,
      source_id,
      exclude_id,
    }: { title; base_id; source_id; exclude_id? },
    ncMeta = Noco.ncMeta,
  ) {
    return !(await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        title,
        ...(source_id ? { source_id } : {}),
      },
      null,
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  async getAliasColObjMap(context: NcContext, columns?: Column[]) {
    return (columns || (await this.getColumns(context))).reduce(
      (sortAgg, c) => ({ ...sortAgg, [c.title]: c }),
      {},
    );
  }

  // For updating table meta
  static async updateMeta(
    context: NcContext,
    tableId: string,
    model: Pick<TableReqType, 'meta' | 'description'>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(model, ['description', 'meta']);

    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      prepareForDb(updateObj),
      tableId,
    );

    await NocoCache.update(
      `${CacheScope.MODEL}:${tableId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }

  static async getNonDefaultViewsCountAndReset(
    context: NcContext,
    {
      modelId,
      userId: _,
    }: {
      modelId: string;
      userId?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const model = await this.get(context, modelId, ncMeta);
    let modelMeta = parseMetaProp(model);

    const views = await View.list(context, modelId, ncMeta);
    modelMeta = {
      ...(modelMeta ?? {}),
      hasNonDefaultViews: views.length > 1,
    };

    await this.updateMeta(context, modelId, { meta: modelMeta }, ncMeta);

    return modelMeta?.hasNonDefaultViews;
  }
}
