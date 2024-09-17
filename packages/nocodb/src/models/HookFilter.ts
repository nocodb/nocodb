import { UITypes } from 'nocodb-sdk';
import type { FilterType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Model from '~/models/Model';
import Column from '~/models/Column';
import View from '~/models/View';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';

export default class Filter {
  id: string;

  fk_model_id?: string;
  fk_view_id?: string;
  fk_column_id?: string;
  fk_parent_id?: string;

  comparison_op?: string;
  value?: string;

  logical_op?: string;
  is_group?: boolean;
  children?: Filter[];
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  column?: Column;

  constructor(data: Filter | FilterType) {
    Object.assign(this, data);
  }

  public async getModel(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Model> {
    return this.fk_view_id
      ? (await View.get(context, this.fk_view_id, ncMeta)).getModel(
          context,
          ncMeta,
        )
      : Model.getByIdOrName(
          context,
          {
            id: this.fk_model_id,
          },
          ncMeta,
        );
  }

  public static async insert(
    context: NcContext,
    filter: Partial<FilterType>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(filter, [
      'id',
      'fk_view_id',
      'fk_column_id',
      'comparison_op',
      'value',
      'fk_parent_id',
      'is_group',
      'logical_op',
      'base_id',
      'source_id',
    ]);

    const model = await Column.get(
      context,
      { colId: filter.fk_column_id },
      ncMeta,
    );

    if (!filter.source_id) {
      insertObj.source_id = model.source_id;
    }

    const row = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      insertObj,
    );
    if (filter?.children?.length) {
      await Promise.all(
        filter.children.map((f) =>
          this.insert(context, { ...f, fk_parent_id: row.id }, ncMeta),
        ),
      );
    }
    return await this.redisPostInsert(context, row.id, filter, ncMeta);
  }

  static async redisPostInsert(
    context: NcContext,
    id,
    filter: Partial<FilterType>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!(id && filter.fk_view_id)) {
      throw new Error(
        `Mandatory fields missing in FILTER_EXP cache population : id(${id}), fk_view_id(${filter.fk_view_id}), fk_parent_id(${filter.fk_view_id})`,
      );
    }
    const key = `${CacheScope.FILTER_EXP}:${id}`;
    let value = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (!value) {
      /* get from db */
      value = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        id,
      );

      /* store in redis */
      await NocoCache.set(key, value).then(async () => {
        /* append key to relevant lists */
        const p = [];
        p.push(
          NocoCache.appendToList(
            CacheScope.FILTER_EXP,
            [filter.fk_view_id],
            key,
          ),
        );
        if (filter.fk_parent_id) {
          p.push(
            NocoCache.appendToList(
              CacheScope.FILTER_EXP,
              [filter.fk_view_id, filter.fk_parent_id],
              key,
            ),
          );
          p.push(
            NocoCache.appendToList(
              CacheScope.FILTER_EXP,
              [filter.fk_parent_id],
              key,
            ),
          );
        }
        if (filter.fk_column_id) {
          p.push(
            NocoCache.appendToList(
              CacheScope.FILTER_EXP,
              [filter.fk_column_id],
              key,
            ),
          );
        }
        await Promise.all(p);
      });
    }
    return new Filter(value);
  }

  static async update(
    context: NcContext,
    id,
    filter: Partial<Filter>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(filter, [
      'fk_column_id',
      'comparison_op',
      'value',
      'fk_parent_id',
      'is_group',
      'logical_op',
    ]);

    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      updateObj,
      id,
    );

    // update cache
    await NocoCache.update(`${CacheScope.FILTER_EXP}:${id}`, updateObj);
  }

  static async delete(context: NcContext, id: string, ncMeta = Noco.ncMeta) {
    const filter = await this.get(context, id, ncMeta);

    const deleteRecursively = async (filter: Filter) => {
      if (!filter) return;
      for (const f of (await filter?.getChildren(context, ncMeta)) || [])
        await deleteRecursively(f);
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        filter.id,
      );
      await NocoCache.deepDel(
        `${CacheScope.FILTER_EXP}:${filter.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    };
    await deleteRecursively(filter);
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

  // public async getGroup(ncMeta = Noco.ncMeta): Promise<Filter> {
  //   if (!this.fk_parent_id) return null;
  //   let filterObj = await NocoCache.get(
  //     `${CacheScope.FILTER_EXP}:${this.fk_parent_id}`,
  //     2
  //   );
  //   if (!filterObj) {
  //     filterObj = await ncMeta.metaGet2(context.workspace_id, context.base_id, MetaTable.FILTER_EXP, {
  //       id: this.fk_parent_id
  //     });
  //     await NocoCache.set(
  //       `${CacheScope.FILTER_EXP}:${this.fk_parent_id}`,
  //       filterObj
  //     );
  //   }
  //   return filterObj && new Filter(filterObj);
  // }
  //
  public async getChildren(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Filter[]> {
    if (this.children) return this.children;
    if (!this.is_group) return null;
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [this.id],
      { key: 'order' },
    );
    let { list: childFilters } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !childFilters.length) {
      childFilters = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          condition: {
            fk_parent_id: this.id,
          },
        },
      );
      await NocoCache.setList(CacheScope.FILTER_EXP, [this.id], childFilters);
    }
    return childFilters && childFilters.map((f) => new Filter(f));
  }

  // public static async getFilter({
  //   viewId
  // }: {
  //   viewId: string;
  // }): Promise<Filter> {
  //   if (!viewId) return null;
  //
  //   const filterObj = await ncMeta.metaGet2(
  // context.workspace_id,
  // context.base_id,
  //     MetaTable.FILTER_EXP,
  //     { fk_view_id: viewId, fk_parent_id: null }
  //   );
  //   return filterObj && new Filter(filterObj);
  // }

  public static async getFilterObject(
    context: NcContext,
    {
      viewId,
    }: {
      viewId: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<FilterType> {
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [viewId],
      { key: 'order' },
    );
    let { list: filters } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !filters.length) {
      filters = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          condition: { fk_view_id: viewId },
        },
      );

      await NocoCache.setList(CacheScope.FILTER_EXP, [viewId], filters);
    }

    const result: FilterType = {
      is_group: true,
      children: [],
      logical_op: 'and',
    };

    const grouped = {};
    const idFilterMapping = {};

    for (const filter of filters) {
      if (!filter._fk_parent_id) {
        result.children.push(filter);
        idFilterMapping[result.id] = result;
      } else {
        grouped[filter._fk_parent_id] = grouped[filter._fk_parent_id] || [];
        grouped[filter._fk_parent_id].push(filter);
        idFilterMapping[filter.id] = filter;
        filter.column = await new Filter(filter).getColumn(context, ncMeta);
        if (filter.column?.uidt === UITypes.LinkToAnotherRecord) {
        }
      }
    }

    for (const [id, children] of Object.entries(grouped)) {
      if (idFilterMapping?.[id]) idFilterMapping[id].children = children;
    }

    // if (!result) {
    //   return (await Filter.insert({
    //     fk_view_id: viewId,
    //     is_group: true,
    //     logical_op: 'AND'
    //   })) as any;
    // }
    return result;
  }

  // static async deleteAll(viewId: string, ncMeta = Noco.ncMeta) {
  //   const filter = await this.getFilterObject({ viewId }, ncMeta);
  //
  //   const deleteRecursively = async filter => {
  //     if (!filter) return;
  //     for (const f of filter?.children || []) await deleteRecursively(f);
  //     if (filter.id) {
  //       await ncMeta.metaDelete(context.workspace_id, context.base_id, filter.id);
  //       await NocoCache.deepDel(
  //         `${CacheScope.FILTER_EXP}:${filter.id}`,
  //         CacheDelDirection.CHILD_TO_PARENT
  //       );
  //     }
  //   };
  //   await deleteRecursively(filter);
  // }
  //
  private static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    let filterObj =
      id &&
      (await NocoCache.get(
        `${CacheScope.FILTER_EXP}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!filterObj) {
      filterObj = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          id,
        },
      );
      await NocoCache.set(`${CacheScope.FILTER_EXP}:${id}`, filterObj);
    }
    return filterObj && new Filter(filterObj);
  }
  //
  static async rootFilterList(
    context: NcContext,
    { viewId }: { viewId: any },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [viewId],
      { key: 'order' },
    );
    let { list: filterObjs } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !filterObjs.length) {
      filterObjs = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          condition: { fk_view_id: viewId },
        },
      );
      await NocoCache.setList(CacheScope.FILTER_EXP, [viewId], filterObjs);
    }
    return filterObjs?.map((f) => new Filter(f));
  }
  //
  // static async parentFilterList(
  //   {
  //     viewId,
  //     parentId
  //   }: {
  //     viewId: any;
  //     parentId: any;
  //   },
  //   ncMeta = Noco.ncMeta
  // ) {
  //   let filterObjs = await NocoCache.getList(CacheScope.FILTER_EXP, [
  //     viewId,
  //     parentId
  //   ]);
  //   if (!filterObjs.length) {
  //     filterObjs = await ncMeta.metaList2(context.workspace_id, context.base_id, MetaTable.FILTER_EXP, {
  //       condition: {
  //         fk_parent_id: parentId,
  //         fk_view_id: viewId
  //       }
  //     });
  //     await NocoCache.setList(
  //       CacheScope.FILTER_EXP,
  //       [viewId, parentId],
  //       filterObjs
  //     );
  //   }
  //   return filterObjs?.map(f => new Filter(f));
  // }
}
