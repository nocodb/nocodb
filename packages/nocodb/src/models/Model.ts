import { isVirtualCol, ModelTypes, UITypes, ViewTypes } from 'nocodb-sdk';
import { BaseModelSqlv2 } from '../db/BaseModelSqlv2';
import Noco from '../Noco';
import { parseMetaProp } from '../utils/modelUtils';
import NocoCache from '../cache/NocoCache';

import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '../utils/globals';
import { NcError } from '../helpers/catchError';
import { sanitize } from '../helpers/sqlSanitize';
import { extractProps } from '../helpers/extractProps';
import Audit from './Audit';
import View from './View';
import Column from './Column';
import type { BoolType, TableReqType, TableType } from 'nocodb-sdk';
import type { XKnex } from '../db/CustomKnex';

export default class Model implements TableType {
  copy_enabled: BoolType;
  base_id: 'db' | string;
  deleted: BoolType;
  enabled: BoolType;
  export_enabled: BoolType;
  id: string;
  order: number;
  parent_id: string;
  password: string;
  pin: BoolType;
  project_id: string;
  schema: any;
  show_all_fields: boolean;
  tags: string;
  type: ModelTypes;

  table_name: string;
  title: string;

  mm: BoolType;

  uuid: string;

  columns?: Column[];
  columnsById?: { [id: string]: Column };
  views?: View[];
  meta?: Record<string, any> | string;

  constructor(data: Partial<TableType | Model>) {
    Object.assign(this, data);
  }

  public async getColumns(ncMeta = Noco.ncMeta): Promise<Column[]> {
    this.columns = await Column.list(
      {
        fk_model_id: this.id,
      },
      ncMeta,
    );
    return this.columns;
  }

  // @ts-ignore
  public async getViews(force = false, ncMeta = Noco.ncMeta): Promise<View[]> {
    this.views = await View.listWithInfo(this.id, ncMeta);
    return this.views;
  }

  public get primaryKey(): Column {
    if (!this.columns) return null;
    return this.columns?.find((c) => c.pk);
  }

  public get primaryKeys(): Column[] {
    if (!this.columns) return null;
    return this.columns?.filter((c) => c.pk);
  }

  public get displayValue(): Column {
    if (!this.columns) return null;
    const pCol = this.columns?.find((c) => c.pv);
    if (pCol) return pCol;
    const pkIndex = this.columns.indexOf(this.primaryKey);
    if (pkIndex < this.columns.length - 1) return this.columns[pkIndex + 1];
    return this.columns[0];
  }

  public static async insert(
    projectId,
    baseId,
    model: Partial<TableReqType> & {
      mm?: BoolType;
      type?: ModelTypes;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(model, [
      'table_name',
      'title',
      'mm',
      'order',
      'type',
      'id',
    ]);

    insertObj.mm = !!insertObj.mm;

    if (!insertObj.order) {
      insertObj.order = await ncMeta.metaGetNextOrder(
        MetaTable.FORM_VIEW_COLUMNS,
        {
          project_id: projectId,
          base_id: baseId,
        },
      );
    }

    if (!insertObj.type) {
      insertObj.type = ModelTypes.TABLE;
    }

    const { id } = await ncMeta.metaInsert2(
      projectId,
      baseId,
      MetaTable.MODELS,
      insertObj,
    );

    await NocoCache.appendToList(
      CacheScope.MODEL,
      [projectId],
      `${CacheScope.MODEL}:${id}`,
    );

    const view = await View.insert(
      {
        fk_model_id: id,
        title: model.title || model.table_name,
        is_default: true,
        type: ViewTypes.GRID,
      },
      ncMeta,
    );

    for (const column of model?.columns || []) {
      await Column.insert({ ...column, fk_model_id: id, view } as any, ncMeta);
    }

    return this.getWithInfo({ id }, ncMeta);
  }

  public static async list(
    {
      project_id,
      base_id,
    }: {
      project_id: string;
      base_id: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model[]> {
    const cachedList = await NocoCache.getList(CacheScope.MODEL, [project_id]);
    let { list: modelList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !modelList.length) {
      modelList = await ncMeta.metaList2(
        project_id,
        base_id,
        MetaTable.MODELS,
        {
          orderBy: {
            order: 'asc',
          },
        },
      );

      // parse meta of each model
      for (const model of modelList) {
        model.meta = parseMetaProp(model);
      }

      await NocoCache.setList(CacheScope.MODEL, [project_id], modelList);
    }
    modelList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return modelList.map((m) => new Model(m));
  }

  public static async listWithInfo(
    {
      project_id,
      db_alias,
    }: {
      project_id: string;
      db_alias: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<Model[]> {
    const cachedList = await NocoCache.getList(CacheScope.MODEL, [
      project_id,
      db_alias,
    ]);
    let { list: modelList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !modelList.length) {
      modelList = await ncMeta.metaList2(
        project_id,
        db_alias,
        MetaTable.MODELS,
      );

      // parse meta of each model
      for (const model of modelList) {
        model.meta = parseMetaProp(model);
      }

      await NocoCache.setList(CacheScope.MODEL, [project_id], modelList);
    }

    return modelList.map((m) => new Model(m));
  }

  public static async clear({ id }: { id: string }): Promise<void> {
    await NocoCache.delAll(CacheScope.MODEL, `*${id}*`);
    await Column.clearList({ fk_model_id: id });
  }

  public static async get(id: string, ncMeta = Noco.ncMeta): Promise<Model> {
    let modelData =
      id &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!modelData) {
      modelData = await ncMeta.metaGet2(null, null, MetaTable.MODELS, id);

      if (modelData) {
        modelData.meta = parseMetaProp(modelData);
        await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      }
    }
    return modelData && new Model(modelData);
  }

  public static async getByIdOrName(
    args:
      | {
          project_id: string;
          base_id: string;
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
      modelData = await ncMeta.metaGet2(null, null, MetaTable.MODELS, k);
      modelData.meta = parseMetaProp(modelData);
    }
    if (modelData) {
      await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      return new Model(modelData);
    }
    return null;
  }

  public static async getWithInfo(
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
        null,
        null,
        MetaTable.MODELS,
        id || {
          table_name,
        },
      );
      modelData.meta = parseMetaProp(modelData);
      await NocoCache.set(`${CacheScope.MODEL}:${modelData.id}`, modelData);
      // modelData.filters = await Filter.getFilterObject({
      //   viewId: modelData.id
      // });
      // modelData.sorts = await Sort.list({ modelId: modelData.id });
    }
    if (modelData) {
      const m = new Model(modelData);
      const columns = await m.getColumns(ncMeta);
      await m.getViews(false, ncMeta);
      m.columnsById = columns.reduce((agg, c) => ({ ...agg, [c.id]: c }), {});
      return m;
    }
    return null;
  }

  public static async getBaseModelSQL(
    args: {
      id?: string;
      viewId?: string;
      dbDriver: XKnex;
      model?: Model;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<BaseModelSqlv2> {
    const model = args?.model || (await this.get(args.id, ncMeta));

    return new BaseModelSqlv2({
      dbDriver: args.dbDriver,
      viewId: args.viewId,
      model,
    });
  }

  async delete(ncMeta = Noco.ncMeta, force = false): Promise<boolean> {
    await Audit.deleteRowComments(this.id);

    for (const view of await this.getViews(true)) {
      await view.delete();
    }

    for (const col of await this.getColumns(ncMeta)) {
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
      }
      if (colOptionTableName && cacheScopeName) {
        await ncMeta.metaDelete(null, null, colOptionTableName, {
          fk_column_id: col.id,
        });
        await NocoCache.deepDel(
          cacheScopeName,
          `${cacheScopeName}:${col.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
    }

    if (force) {
      const leftOverColumns = await ncMeta.metaList2(
        null,
        null,
        MetaTable.COL_RELATIONS,
        {
          condition: {
            fk_related_model_id: this.id,
          },
        },
      );

      for (const col of leftOverColumns) {
        await NocoCache.deepDel(
          CacheScope.COL_RELATION,
          `${CacheScope.COL_RELATION}:${col.fk_column_id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }

      await ncMeta.metaDelete(null, null, MetaTable.COL_RELATIONS, {
        fk_related_model_id: this.id,
      });
    }

    await NocoCache.deepDel(
      CacheScope.COLUMN,
      `${CacheScope.COLUMN}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await ncMeta.metaDelete(null, null, MetaTable.COLUMNS, {
      fk_model_id: this.id,
    });

    await NocoCache.deepDel(
      CacheScope.MODEL,
      `${CacheScope.MODEL}:${this.id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await ncMeta.metaDelete(null, null, MetaTable.MODELS, this.id);

    await NocoCache.del(`${CacheScope.MODEL}:${this.project_id}:${this.id}`);
    await NocoCache.del(`${CacheScope.MODEL}:${this.project_id}:${this.title}`);
    return true;
  }

  async mapAliasToColumn(data) {
    const insertObj = {};
    for (const col of await this.getColumns()) {
      if (isVirtualCol(col)) continue;
      let val =
        data?.[col.column_name] !== undefined
          ? data?.[col.column_name]
          : data?.[col.title];
      if (val !== undefined) {
        if (col.uidt === UITypes.Attachment && typeof val !== 'string') {
          val = JSON.stringify(val);
        }
        insertObj[sanitize(col.column_name)] = val;
      }
    }
    return insertObj;
  }

  async mapColumnToAlias(data) {
    const res = {};
    for (const col of await this.getColumns()) {
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
    // get existing cache
    const key = `${CacheScope.MODEL}:${tableId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    // update alias
    if (o) {
      o.title = title;
      o.table_name = table_name;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODELS,
      {
        title,
        table_name,
      },
      tableId,
    );
  }

  static async markAsMmTable(tableId, isMm = true, ncMeta = Noco.ncMeta) {
    // get existing cache
    const key = `${CacheScope.MODEL}:${tableId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    // update alias
    if (o) {
      o.mm = isMm;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODELS,
      {
        mm: isMm,
      },
      tableId,
    );
  }

  async getAliasColMapping() {
    return (await this.getColumns()).reduce((o, c) => {
      if (c.column_name) {
        o[c.title] = c.column_name;
      }
      return o;
    }, {});
  }

  async getColAliasMapping() {
    return (await this.getColumns()).reduce((o, c) => {
      if (c.column_name) {
        o[c.column_name] = c.title;
      }
      return o;
    }, {});
  }

  static async updateOrder(
    tableId: string,
    order: number,
    ncMeta = Noco.ncMeta,
  ) {
    // get existing cache
    const key = `${CacheScope.MODEL}:${tableId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o.order = order;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODELS,
      {
        order,
      },
      tableId,
    );
  }

  static async updatePrimaryColumn(
    tableId: string,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const model = await this.getWithInfo({ id: tableId });
    const newPvCol = model.columns.find((c) => c.id === columnId);

    if (!newPvCol) NcError.badRequest('Column not found');

    // drop existing primary column/s
    for (const col of model.columns?.filter((c) => c.pv) || []) {
      // get existing cache
      const key = `${CacheScope.COLUMN}:${col.id}`;
      const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
      if (o) {
        o.pv = false;
        // set cache
        await NocoCache.set(key, o);
      }
      // set meta
      await ncMeta.metaUpdate(
        null,
        null,
        MetaTable.COLUMNS,
        {
          pv: false,
        },
        col.id,
      );
    }

    // get existing cache
    const key = `${CacheScope.COLUMN}:${newPvCol.id}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o.pv = true;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COLUMNS,
      {
        pv: true,
      },
      newPvCol.id,
    );

    const grid_views_with_column = await ncMeta.metaList2(
      null,
      null,
      MetaTable.GRID_VIEW_COLUMNS,
      {
        condition: {
          fk_column_id: newPvCol.id,
        },
      },
    );

    if (grid_views_with_column.length) {
      for (const gv of grid_views_with_column) {
        await View.fixPVColumnForView(gv.fk_view_id, ncMeta);
      }
    }

    return true;
  }

  static async setAsMm(id: any, ncMeta = Noco.ncMeta) {
    // get existing cache
    const key = `${CacheScope.MODEL}:${id}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o.mm = true;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODELS,
      {
        mm: true,
      },
      id,
    );
  }

  static async getByAliasOrId(
    {
      project_id,
      base_id,
      aliasOrId,
    }: {
      project_id: string;
      base_id?: string;
      aliasOrId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const modelId =
      project_id &&
      aliasOrId &&
      (await NocoCache.get(
        `${CacheScope.MODEL}:${project_id}:${aliasOrId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!modelId) {
      const model = base_id
        ? await ncMeta.metaGet2(
            null,
            null,
            MetaTable.MODELS,
            { project_id, base_id },
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
            null,
            null,
            MetaTable.MODELS,
            { project_id },
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
        await NocoCache.set(
          `${CacheScope.MODEL}:${project_id}:${aliasOrId}`,
          model.id,
        );
        await NocoCache.set(`${CacheScope.MODEL}:${model.id}`, model);
      }
      return model && new Model(model);
    }
    return modelId && this.get(modelId);
  }

  static async checkTitleAvailable(
    {
      table_name,
      project_id,
      base_id,
      exclude_id,
    }: { table_name; project_id; base_id; exclude_id? },
    ncMeta = Noco.ncMeta,
  ) {
    return !(await ncMeta.metaGet2(
      project_id,
      base_id,
      MetaTable.MODELS,
      {
        table_name,
      },
      null,
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  static async checkAliasAvailable(
    {
      title,
      project_id,
      base_id,
      exclude_id,
    }: { title; project_id; base_id; exclude_id? },
    ncMeta = Noco.ncMeta,
  ) {
    return !(await ncMeta.metaGet2(
      project_id,
      base_id,
      MetaTable.MODELS,
      {
        title,
      },
      null,
      exclude_id && { id: { neq: exclude_id } },
    ));
  }

  async getAliasColObjMap() {
    return (await this.getColumns()).reduce(
      (sortAgg, c) => ({ ...sortAgg, [c.title]: c }),
      {},
    );
  }

  // For updating table meta
  static async updateMeta(
    tableId: string,
    meta: string | Record<string, any>,
    ncMeta = Noco.ncMeta,
  ) {
    // get existing cache
    const key = `${CacheScope.MODEL}:${tableId}`;
    const existingCache = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (existingCache) {
      try {
        existingCache.meta = typeof meta === 'string' ? JSON.parse(meta) : meta;
        // set cache
        await NocoCache.set(key, existingCache);
      } catch {}
    }
    // set meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.MODELS,
      {
        meta: typeof meta === 'object' ? JSON.stringify(meta) : meta,
      },
      tableId,
    );
  }
}
