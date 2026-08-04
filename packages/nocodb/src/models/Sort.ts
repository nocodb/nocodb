import type { SortType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Model from '~/models/Model';
import Column from '~/models/Column';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import View from '~/models/View';
import { isReplay } from '~/helpers/replayScope';

export default class Sort {
  id: string;

  fk_view_id?: string;
  fk_column_id?: string;
  // When set, this sort is scoped to a lookup column (it orders the
  // relation sub-query for that column) instead of a view — mirrors
  // Filter.fk_link_col_id used by the "limit records by conditions" feature.
  fk_lookup_col_id?: string;
  fk_level_id?: string;
  direction?: 'asc' | 'desc' | 'count-desc' | 'count-asc';
  enabled?: boolean;
  order?: number;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;

  constructor(data: Partial<SortType>) {
    Object.assign(this, data);
  }

  // skip viewWebhookManager for this, Sort.deleteAll is not a standalone operation, it's invoked by view service
  public static async deleteAll(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await NocoCache.deepDel(
      context,
      `${CacheScope.SORT}:${viewId}`,
      CacheDelDirection.PARENT_TO_CHILD,
    );
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      {
        fk_view_id: viewId,
      },
    );

    // on delete, delete any optimised single query cache
    {
      const view = await View.get(context, viewId, false, ncMeta);
      if (view) {
        await View.clearSingleQueryCache(
          context,
          view.fk_model_id,
          [view],
          ncMeta,
        );
      }
    }
  }

  public static async insert(
    context: NcContext,
    sortObj: Partial<Sort> & { push_to_top?: boolean; order?: number },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(sortObj, [
      'id',
      'fk_view_id',
      'fk_column_id',
      'fk_lookup_col_id',
      'fk_level_id',
      'direction',
      'enabled',
      'base_id',
      'source_id',
    ]);

    // A sort belongs to a view OR (for lookup-scoped sorts) a lookup column.
    const parentCond = sortObj.fk_lookup_col_id
      ? { fk_lookup_col_id: sortObj.fk_lookup_col_id }
      : { fk_view_id: sortObj.fk_view_id };

    const replayKeepOrder = isReplay() && sortObj.order != null;
    if (replayKeepOrder) {
      insertObj.order = sortObj.order;
    } else {
      // todo: implement a generic function
      insertObj.order = sortObj.push_to_top
        ? 1
        : (+(
            await ncMeta
              .knex(MetaTable.SORT)
              .max('order', { as: 'order' })
              .where(parentCond)
              .first()
          )?.order || 0) + 1;
    }

    const model = await Column.get(
      context,
      { colId: sortObj.fk_column_id },
      ncMeta,
    );

    if (!sortObj.source_id) {
      insertObj.source_id = model.source_id;
    }

    // increment existing order
    if (sortObj.push_to_top) {
      await ncMeta.knex(MetaTable.SORT).where(parentCond).increment('order', 1);
    }

    if (isReplay() && sortObj.id) {
      insertObj.id = sortObj.id;
    }

    const row = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      insertObj,
    );
    if (sortObj.push_to_top) {
      // Refresh the list cache for whichever parent this sort belongs to — a
      // view (`[fk_view_id]`) or a lookup column (`['lookup', fk_lookup_col_id]`,
      // the distinct prefix used by listByLookupColumn). Keying on fk_view_id
      // unconditionally would corrupt the cache for lookup-scoped sorts.
      const listCacheKey = sortObj.fk_lookup_col_id
        ? ['lookup', sortObj.fk_lookup_col_id]
        : [sortObj.fk_view_id];
      const sortList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.SORT,
        {
          condition: parentCond,
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(context, CacheScope.SORT, listCacheKey, sortList);
    }
    // on insert, delete any optimised single query cache
    await Sort.clearSingleQueryCacheForSort(context, row, ncMeta);

    return this.get(context, row.id, ncMeta).then(async (sort) => {
      if (!sortObj.push_to_top) {
        if (sortObj.fk_view_id)
          await NocoCache.appendToList(
            context,
            CacheScope.SORT,
            [sortObj.fk_view_id],
            `${CacheScope.SORT}:${row.id}`,
          );
        if (sortObj.fk_column_id)
          await NocoCache.appendToList(
            context,
            CacheScope.SORT,
            [sortObj.fk_column_id],
            `${CacheScope.SORT}:${row.id}`,
          );
        // Lookup-scoped list cache (distinct prefix to avoid colliding with the
        // view/column lists), mirrored by listByLookupColumn().
        if (sortObj.fk_lookup_col_id)
          await NocoCache.appendToList(
            context,
            CacheScope.SORT,
            ['lookup', sortObj.fk_lookup_col_id],
            `${CacheScope.SORT}:${row.id}`,
          );
      }
      return sort;
    });
  }

  public getColumn(context: NcContext, ncMeta = Noco.ncMeta): Promise<Column> {
    if (!this.fk_column_id) return null;
    return Column.get(
      context,
      {
        colId: this.fk_column_id,
      },
      ncMeta,
    );
  }

  public static async list(
    context: NcContext,
    { viewId }: { viewId: string },
    ncMeta = Noco.ncMeta,
  ): Promise<Sort[]> {
    if (!viewId) return null;
    const cachedList = await NocoCache.getList(context, CacheScope.SORT, [
      viewId,
    ]);
    let { list: sortList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !sortList.length) {
      sortList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.SORT,
        {
          condition: { fk_view_id: viewId },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(context, CacheScope.SORT, [viewId], sortList);
    }
    sortList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return sortList.map((s) => new Sort(s));
  }

  // Sorts scoped to a lookup column (used to order the relation sub-query).
  // Mirrors Filter.allLinkFilterList; cached under a distinct 'lookup' prefix.
  public static async listByLookupColumn(
    context: NcContext,
    { columnId }: { columnId: string },
    ncMeta = Noco.ncMeta,
  ): Promise<Sort[]> {
    if (!columnId) return [];
    const cachedList = await NocoCache.getList(context, CacheScope.SORT, [
      'lookup',
      columnId,
    ]);
    let { list: sortList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !sortList.length) {
      sortList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.SORT,
        {
          condition: { fk_lookup_col_id: columnId },
          orderBy: { order: 'asc' },
        },
      );
      await NocoCache.setList(
        context,
        CacheScope.SORT,
        ['lookup', columnId],
        sortList,
      );
    }
    sortList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return sortList.map((s) => new Sort(s));
  }

  // Clear the single-query cache for the model a sort affects: the view's model
  // for view sorts, or the model owning the lookup column for lookup sorts.
  private static async clearSingleQueryCacheForSort(
    context: NcContext,
    sort: { fk_view_id?: string; fk_lookup_col_id?: string },
    ncMeta = Noco.ncMeta,
  ) {
    if (sort?.fk_view_id) {
      const view = await View.get(context, sort.fk_view_id, false, ncMeta);
      if (view) {
        await View.clearSingleQueryCache(
          context,
          view.fk_model_id,
          [view],
          ncMeta,
        );
      }
    } else if (sort?.fk_lookup_col_id) {
      const lookupCol = await Column.get(
        context,
        { colId: sort.fk_lookup_col_id },
        ncMeta,
      );
      if (lookupCol?.fk_model_id) {
        await View.clearSingleQueryCache(
          context,
          lookupCol.fk_model_id,
          undefined,
          ncMeta,
        );
      }
    }
  }

  public static async update(
    context: NcContext,
    sortId,
    body,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'fk_column_id',
      'direction',
      'enabled',
      'order',
    ]);

    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      updateObj,
      sortId,
    );

    await NocoCache.update(context, `${CacheScope.SORT}:${sortId}`, updateObj);

    // on update, delete any optimised single query cache
    {
      const sort = await this.get(context, sortId, ncMeta);
      await Sort.clearSingleQueryCacheForSort(context, sort, ncMeta);
    }

    return res;
  }

  public static async delete(
    context: NcContext,
    sortId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const sort = await this.get(context, sortId, ncMeta);

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      sortId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.SORT}:${sortId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // on delete, delete any optimised single query cache
    await Sort.clearSingleQueryCacheForSort(context, sort, ncMeta);
  }

  public static async get(context: NcContext, id: any, ncMeta = Noco.ncMeta) {
    let sortData =
      id &&
      (await NocoCache.get(
        context,
        `${CacheScope.SORT}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!sortData) {
      sortData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.SORT,
        id,
      );
      await NocoCache.set(context, `${CacheScope.SORT}:${id}`, sortData);
    }
    return sortData && new Sort(sortData);
  }

  public async getModel(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    return Model.getByIdOrName(
      context,
      {
        id: this.fk_view_id,
      },
      ncMeta,
    );
  }
}

export interface SortObject {
  id?: string;
  fk_view_id: string;
  fk_column_id?: string;
  direction?: 'asc' | 'desc';
}
