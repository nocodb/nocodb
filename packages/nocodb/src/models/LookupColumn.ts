import { UITypes } from 'nocodb-sdk';
import type { LookupType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import View from './View';

export default class LookupColumn implements LookupType {
  fk_column_id: string;
  fk_relation_column_id: string;
  fk_lookup_column_id: string;
  fk_target_view_id?: string;
  meta?: any;
  filters?: any[];

  constructor(data: LookupColumn) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COLUMN}:${columnId}:${CacheGetType.LOOKUP}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_LOOKUP,
        {
          fk_column_id: columnId,
        },
      );
      await NocoCache.set(
        `${CacheScope.COLUMN}:${columnId}:${CacheGetType.LOOKUP}`,
        column,
      );
    }

    return column && new LookupColumn(column);
  }

  public static async insert(
    context: NcContext,
    column: Partial<LookupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = {
      fk_column_id: column.fk_column_id,
      fk_relation_column_id: column.fk_relation_column_id,
      fk_lookup_column_id: column.fk_lookup_column_id,
      fk_target_view_id: column.fk_target_view_id,
      meta: column.meta,
    };

    if (!(column.fk_column_id && column.fk_relation_column_id)) {
      throw new Error(`Mandatory fields missing`);
    }

    const { id, fk_column_id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LOOKUP,
      insertObj,
    );

    await NocoCache.set(
      `${CacheScope.COLUMN}:${fk_column_id}:${CacheGetType.LOOKUP}`,
      insertObj,
    );

    return this.get(context, fk_column_id, ncMeta);
  }

  public static async update(
    context: NcContext,
    columnId: string,
    column: Partial<LookupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = {
      fk_relation_column_id: column.fk_relation_column_id,
      fk_lookup_column_id: column.fk_lookup_column_id,
      fk_target_view_id: column.fk_target_view_id,
      meta: column.meta,
    };
    // get existing cache
    const key = `${CacheScope.COLUMN}:${columnId}:${CacheGetType.LOOKUP}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      Object.assign(o, updateObj);
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LOOKUP,
      updateObj,
      {
        fk_column_id: columnId,
      },
    );

    return this.get(context, columnId, ncMeta);
  }

  async getRelationColumn(context: NcContext, ncMeta = Noco.ncMeta) {
    return await Column.get(
      context,
      {
        colId: this.fk_relation_column_id,
      },
      ncMeta,
    );
  }

  async getLookupColumn(context: NcContext, ncMeta = Noco.ncMeta) {
    return await Column.get(
      context,
      {
        colId: this.fk_lookup_column_id,
      },
      ncMeta,
    );
  }
  
  async getTargetView(context: NcContext, ncMeta = Noco.ncMeta) {
    if (!this.fk_target_view_id) return null;
    return await View.get(context, this.fk_target_view_id, ncMeta);
  }
}
