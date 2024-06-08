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

export default class Sort {
  id: string;

  fk_view_id: string;
  fk_column_id?: string;
  direction?: 'asc' | 'desc' | 'count-desc' | 'count-asc';
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;

  constructor(data: Partial<SortType>) {
    Object.assign(this, data);
  }

  public static async deleteAll(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await NocoCache.deepDel(
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
      const view = await View.get(context, viewId, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
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
      'direction',
      'base_id',
      'source_id',
    ]);

    // todo: implement a generic function
    insertObj.order = sortObj.push_to_top
      ? 1
      : (+(
          await ncMeta
            .knex(MetaTable.SORT)
            .max('order', { as: 'order' })
            .where({
              fk_view_id: sortObj.fk_view_id,
            })
            .first()
        )?.order || 0) + 1;

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
      await ncMeta
        .knex(MetaTable.SORT)
        .where({
          fk_view_id: sortObj.fk_view_id,
        })
        .increment('order', 1);
    }

    const row = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      insertObj,
    );
    if (sortObj.push_to_top) {
      const sortList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.SORT,
        {
          condition: { fk_view_id: sortObj.fk_view_id },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.SORT, [sortObj.fk_view_id], sortList);
    }
    // on insert, delete any optimised single query cache
    {
      const view = await View.get(context, row.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
    }

    return this.get(context, row.id, ncMeta).then(async (sort) => {
      if (!sortObj.push_to_top) {
        await NocoCache.appendToList(
          CacheScope.SORT,
          [sortObj.fk_view_id],
          `${CacheScope.SORT}:${row.id}`,
        );
        await NocoCache.appendToList(
          CacheScope.SORT,
          [sortObj.fk_column_id],
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
    const cachedList = await NocoCache.getList(CacheScope.SORT, [viewId]);
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
      await NocoCache.setList(CacheScope.SORT, [viewId], sortList);
    }
    sortList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return sortList.map((s) => new Sort(s));
  }

  public static async update(
    context: NcContext,
    sortId,
    body,
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      {
        fk_column_id: body.fk_column_id,
        direction: body.direction,
      },
      sortId,
    );

    await NocoCache.update(`${CacheScope.SORT}:${sortId}`, {
      fk_column_id: body.fk_column_id,
      direction: body.direction,
    });

    // on update, delete any optimised single query cache
    {
      const sort = await this.get(context, sortId, ncMeta);
      const view = await View.get(context, sort.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
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
      `${CacheScope.SORT}:${sortId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    // on delete, delete any optimised single query cache
    if (sort?.fk_view_id) {
      const view = await View.get(context, sort.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
    }
  }

  public static async get(context: NcContext, id: any, ncMeta = Noco.ncMeta) {
    let sortData =
      id &&
      (await NocoCache.get(
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
      await NocoCache.set(`${CacheScope.SORT}:${id}`, sortData);
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
