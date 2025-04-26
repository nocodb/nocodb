import type { RollupType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import View from './View';

export default class RollupColumn implements RollupType {
  fk_column_id: string;
  fk_relation_column_id: string;
  fk_rollup_column_id: string;
  rollup_function: string;
  fk_target_view_id?: string;
  meta?: any;
  filters?: any[];

  constructor(data: RollupColumn) {
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
        `${CacheScope.COLUMN}:${columnId}:${CacheGetType.ROLLUP}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_ROLLUP,
        {
          fk_column_id: columnId,
        },
      );
      await NocoCache.set(
        `${CacheScope.COLUMN}:${columnId}:${CacheGetType.ROLLUP}`,
        column,
      );
    }

    return column && new RollupColumn(column);
  }

  public static async insert(
    context: NcContext,
    column: Partial<RollupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = {
      fk_column_id: column.fk_column_id,
      fk_relation_column_id: column.fk_relation_column_id,
      fk_rollup_column_id: column.fk_rollup_column_id,
      rollup_function: column.rollup_function,
      fk_target_view_id: column.fk_target_view_id,
      meta: column.meta,
    };

    if (
      !(
        column.fk_column_id &&
        column.fk_relation_column_id &&
        column.fk_rollup_column_id &&
        column.rollup_function
      )
    ) {
      throw new Error(`Mandatory fields missing`);
    }

    const { id, fk_column_id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_ROLLUP,
      insertObj,
    );

    await NocoCache.set(
      `${CacheScope.COLUMN}:${fk_column_id}:${CacheGetType.ROLLUP}`,
      insertObj,
    );

    return this.get(context, fk_column_id, ncMeta);
  }

  public static async update(
    context: NcContext,
    columnId: string,
    column: Partial<RollupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = {
      fk_relation_column_id: column.fk_relation_column_id,
      fk_rollup_column_id: column.fk_rollup_column_id,
      rollup_function: column.rollup_function,
      fk_target_view_id: column.fk_target_view_id,
      meta: column.meta,
    };
    // get existing cache
    const key = `${CacheScope.COLUMN}:${columnId}:${CacheGetType.ROLLUP}`;
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
      MetaTable.COL_ROLLUP,
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

  async getRollupColumn(context: NcContext, ncMeta = Noco.ncMeta) {
    return await Column.get(
      context,
      {
        colId: this.fk_rollup_column_id,
      },
      ncMeta,
    );
  }
  
  async getTargetView(context: NcContext, ncMeta = Noco.ncMeta) {
    if (!this.fk_target_view_id) return null;
    return await View.get(context, this.fk_target_view_id, ncMeta);
  }
}
