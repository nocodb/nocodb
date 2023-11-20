import type { SortType } from 'nocodb-sdk';
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
  direction?: 'asc' | 'desc';
  base_id?: string;
  source_id?: string;

  constructor(data: Partial<SortType>) {
    Object.assign(this, data);
  }

  public static async deleteAll(viewId: string, ncMeta = Noco.ncMeta) {
    await NocoCache.deepDel(
      CacheScope.SORT,
      `${CacheScope.SORT}:${viewId}`,
      CacheDelDirection.PARENT_TO_CHILD,
    );
    await ncMeta.metaDelete(null, null, MetaTable.SORT, {
      fk_view_id: viewId,
    });

    // on delete, delete any optimised single query cache
    {
      const view = await View.get(viewId, ncMeta);
      await NocoCache.delAll(
        CacheScope.SINGLE_QUERY,
        `${view.fk_model_id}:${view.id}:*`,
      );
    }
  }

  public static async insert(
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
    if (!(sortObj.base_id && sortObj.source_id)) {
      const model = await Column.get({ colId: sortObj.fk_column_id }, ncMeta);
      insertObj.base_id = model.base_id;
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

    const row = await ncMeta.metaInsert2(null, null, MetaTable.SORT, insertObj);
    if (sortObj.push_to_top) {
      const sortList = await ncMeta.metaList2(null, null, MetaTable.SORT, {
        condition: { fk_view_id: sortObj.fk_view_id },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.delAll(CacheScope.SORT, `${sortObj.fk_view_id}:*`);
      await NocoCache.setList(CacheScope.SORT, [sortObj.fk_view_id], sortList);
    } else {
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

    // on insert, delete any optimised single query cache
    {
      const view = await View.get(row.fk_view_id, ncMeta);
      await NocoCache.delAll(
        CacheScope.SINGLE_QUERY,
        `${view.fk_model_id}:${view.id}:*`,
      );
    }

    return this.get(row.id, ncMeta);
  }

  public getColumn(): Promise<Column> {
    if (!this.fk_column_id) return null;
    return Column.get({
      colId: this.fk_column_id,
    });
  }

  public static async list(
    { viewId }: { viewId: string },
    ncMeta = Noco.ncMeta,
  ): Promise<Sort[]> {
    if (!viewId) return null;
    const cachedList = await NocoCache.getList(CacheScope.SORT, [viewId]);
    let { list: sortList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !sortList.length) {
      sortList = await ncMeta.metaList2(null, null, MetaTable.SORT, {
        condition: { fk_view_id: viewId },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.setList(CacheScope.SORT, [viewId], sortList);
    }
    sortList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return sortList.map((s) => new Sort(s));
  }

  public static async update(sortId, body, ncMeta = Noco.ncMeta) {
    // get existing cache
    const key = `${CacheScope.SORT}:${sortId}`;
    const o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update fk_column_id & direction
      o.fk_column_id = body.fk_column_id;
      o.direction = body.direction;
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.SORT,
      {
        fk_column_id: body.fk_column_id,
        direction: body.direction,
      },
      sortId,
    );

    // on update, delete any optimised single query cache
    {
      const sort = await this.get(sortId, ncMeta);
      const view = await View.get(sort.fk_view_id, ncMeta);
      await NocoCache.delAll(
        CacheScope.SINGLE_QUERY,
        `${view.fk_model_id}:${view.id}:*`,
      );
    }

    return res;
  }

  public static async delete(sortId: string, ncMeta = Noco.ncMeta) {
    const sort = await this.get(sortId, ncMeta);
    await NocoCache.deepDel(
      CacheScope.SORT,
      `${CacheScope.SORT}:${sortId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );
    await ncMeta.metaDelete(null, null, MetaTable.SORT, sortId);

    // on delete, delete any optimised single query cache
    if (sort?.fk_view_id) {
      const view = await View.get(sort.fk_view_id, ncMeta);
      await NocoCache.delAll(
        CacheScope.SINGLE_QUERY,
        `${view.fk_model_id}:${view.id}:*`,
      );
    }
  }

  public static async get(id: any, ncMeta = Noco.ncMeta) {
    let sortData =
      id &&
      (await NocoCache.get(
        `${CacheScope.SORT}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!sortData) {
      sortData = await ncMeta.metaGet2(null, null, MetaTable.SORT, id);
      await NocoCache.set(`${CacheScope.SORT}:${id}`, sortData);
    }
    return sortData && new Sort(sortData);
  }

  public async getModel(ncMeta = Noco.ncMeta): Promise<Model> {
    return Model.getByIdOrName(
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
