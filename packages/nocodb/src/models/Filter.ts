import { UITypes } from 'nocodb-sdk';
import type { BoolType, FilterType } from 'nocodb-sdk';
import type { COMPARISON_OPS, COMPARISON_SUB_OPS } from '~/utils/globals';
import Model from '~/models/Model';
import Column from '~/models/Column';
import Hook from '~/models/Hook';
import View from '~/models/View';
import Noco from '~/Noco';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';

export default class Filter implements FilterType {
  id: string;

  fk_model_id?: string;
  fk_view_id?: string;
  fk_hook_id?: string;
  fk_column_id?: string;
  fk_parent_id?: string;

  comparison_op?: (typeof COMPARISON_OPS)[number];
  comparison_sub_op?: (typeof COMPARISON_SUB_OPS)[number];

  value?: string;

  logical_op?: 'and' | 'or' | 'not';
  is_group?: BoolType;
  children?: Filter[];
  base_id?: string;
  source_id?: string;
  column?: Column;

  constructor(data: Filter | FilterType) {
    Object.assign(this, data);
  }

  public static castType(filter: Filter): Filter {
    return filter && new Filter(filter);
  }

  public castType(filter: Filter): Filter {
    return filter && new Filter(filter);
  }

  public async getModel(ncMeta = Noco.ncMeta): Promise<Model> {
    return this.fk_view_id
      ? (await View.get(this.fk_view_id, ncMeta)).getModel(ncMeta)
      : Model.getByIdOrName(
          {
            id: this.fk_model_id,
          },
          ncMeta,
        );
  }

  public static async insert(
    filter: Partial<FilterType> & { order?: number },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(filter, [
      'id',
      'fk_view_id',
      'fk_hook_id',
      'fk_column_id',
      'comparison_op',
      'comparison_sub_op',
      'value',
      'fk_parent_id',
      'is_group',
      'logical_op',
      'base_id',
      'source_id',
      'order',
    ]);

    const referencedModelColName = filter.fk_hook_id
      ? 'fk_hook_id'
      : 'fk_view_id';
    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.FILTER_EXP, {
      [referencedModelColName]: filter[referencedModelColName],
    });

    if (!(filter.base_id && filter.source_id)) {
      let model: { base_id?: string; source_id?: string };
      if (filter.fk_view_id) {
        model = await View.get(filter.fk_view_id, ncMeta);
      } else if (filter.fk_hook_id) {
        model = await Hook.get(filter.fk_hook_id, ncMeta);
      } else if (filter.fk_column_id) {
        model = await Column.get({ colId: filter.fk_column_id }, ncMeta);
      } else {
        NcError.badRequest('Invalid filter');
      }

      if (model != null) {
        insertObj.base_id = model.base_id;
        insertObj.source_id = model.source_id;
      }
    }

    const row = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.FILTER_EXP,
      insertObj,
    );
    if (filter?.children?.length) {
      await Promise.all(
        filter.children.map((f) =>
          this.insert(
            {
              ...f,
              fk_parent_id: row.id,
              [filter.fk_hook_id ? 'fk_hook_id' : 'fk_view_id']:
                filter.fk_hook_id ? filter.fk_hook_id : filter.fk_view_id,
            },
            ncMeta,
          ),
        ),
      );
    }
    return await this.redisPostInsert(row.id, filter, ncMeta);
  }

  static async redisPostInsert(
    id,
    filter: Partial<FilterType>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!(id && (filter.fk_view_id || filter.fk_hook_id))) {
      throw new Error(
        `Mandatory fields missing in FITLER_EXP cache population : id(${id}), fk_view_id(${filter.fk_view_id}), fk_hook_id(${filter.fk_hook_id})`,
      );
    }
    const key = `${CacheScope.FILTER_EXP}:${id}`;
    let value = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (!value) {
      /* get from db */
      value = await ncMeta.metaGet2(null, null, MetaTable.FILTER_EXP, id);
      // pushing calls for Promise.all
      const p = [];
      /* store in redis */
      p.push(NocoCache.set(key, value));
      /* append key to relevant lists */
      if (filter.fk_view_id) {
        p.push(
          NocoCache.appendToList(
            CacheScope.FILTER_EXP,
            [filter.fk_view_id],
            key,
          ),
        );
      }
      if (filter.fk_hook_id) {
        p.push(
          NocoCache.appendToList(
            CacheScope.FILTER_EXP,
            [filter.fk_hook_id],
            key,
          ),
        );
      }
      if (filter.fk_parent_id) {
        if (filter.fk_view_id) {
          p.push(
            NocoCache.appendToList(
              CacheScope.FILTER_EXP,
              [filter.fk_view_id, filter.fk_parent_id],
              key,
            ),
          );
        }
        if (filter.fk_hook_id) {
          p.push(
            NocoCache.appendToList(
              CacheScope.FILTER_EXP,
              [filter.fk_hook_id, filter.fk_parent_id],
              key,
            ),
          );
        }
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
    }

    // on new filter creation delete any optimised single query cache
    {
      // if not a view filter then no need to delete
      if (filter.fk_view_id) {
        const view = await View.get(filter.fk_view_id, ncMeta);
        await NocoCache.delAll(
          CacheScope.SINGLE_QUERY,
          `${view.fk_model_id}:${view.id}:*`,
        );
      }
    }

    return this.castType(value);
  }

  static async update(id, filter: Partial<Filter>, ncMeta = Noco.ncMeta) {
    const updateObj = extractProps(filter, [
      'fk_column_id',
      'comparison_op',
      'comparison_sub_op',
      'value',
      'fk_parent_id',
      'is_group',
      'logical_op',
    ]);

    if (typeof updateObj.value === 'string')
      updateObj.value = updateObj.value.slice(0, 255);

    // get existing cache
    const key = `${CacheScope.FILTER_EXP}:${id}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    // update alias
    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.FILTER_EXP,
      updateObj,
      id,
    );

    // on update delete any optimised single query cache
    {
      const filter = await this.get(id, ncMeta);
      // if not a view filter then no need to delete
      if (filter.fk_view_id) {
        const view = await View.get(filter.fk_view_id, ncMeta);
        await NocoCache.delAll(
          CacheScope.SINGLE_QUERY,
          `${view.fk_model_id}:${view.id}:*`,
        );
      }
    }

    return res;
  }

  static async delete(id: string, ncMeta = Noco.ncMeta) {
    const filter = await this.get(id, ncMeta);

    const deleteRecursively = async (filter: Filter) => {
      if (!filter) return;
      for (const f of (await filter?.getChildren()) || [])
        await deleteRecursively(f);
      await ncMeta.metaDelete(null, null, MetaTable.FILTER_EXP, filter.id);
      await NocoCache.deepDel(
        CacheScope.FILTER_EXP,
        `${CacheScope.FILTER_EXP}:${filter.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    };
    await deleteRecursively(filter);

    // delete any optimised single query cache
    {
      // if not a view filter then no need to delete
      if (filter.fk_view_id) {
        const view = await View.get(filter.fk_view_id, ncMeta);
        await NocoCache.delAll(
          CacheScope.SINGLE_QUERY,
          `${view.fk_model_id}:${view.id}:*`,
        );
      }
    }
  }

  public getColumn(): Promise<Column> {
    if (!this.fk_column_id) return null;
    return Column.get({
      colId: this.fk_column_id,
    });
  }

  public async getGroup(ncMeta = Noco.ncMeta): Promise<Filter> {
    if (!this.fk_parent_id) return null;
    let filterObj = await NocoCache.get(
      `${CacheScope.FILTER_EXP}:${this.fk_parent_id}`,
      2,
    );
    if (!filterObj) {
      filterObj = await ncMeta.metaGet2(null, null, MetaTable.FILTER_EXP, {
        id: this.fk_parent_id,
      });
      await NocoCache.set(
        `${CacheScope.FILTER_EXP}:${this.fk_parent_id}`,
        filterObj,
      );
    }
    return this.castType(filterObj);
  }

  public async getChildren(ncMeta = Noco.ncMeta): Promise<Filter[]> {
    if (this.children) return this.children;
    if (!this.is_group) return null;
    const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [
      this.id,
    ]);
    let { list: childFilters } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !childFilters.length) {
      childFilters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP, {
        condition: {
          fk_parent_id: this.id,
        },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.setList(CacheScope.FILTER_EXP, [this.id], childFilters);
    }
    return childFilters && childFilters.map((f) => this.castType(f));
  }

  // public static async getFilter({
  //   viewId
  // }: {
  //   viewId: string;
  // }): Promise<Filter> {
  //   if (!viewId) return null;
  //
  //   const filterObj = await ncMeta.metaGet2(
  //     null,
  //     null,
  //     MetaTable.FILTER_EXP,
  //     { fk_view_id: viewId, fk_parent_id: null }
  //   );
  //   return filterObj && new Filter(filterObj);
  // }

  public static async getFilterObject(
    {
      viewId,
      hookId,
    }: {
      viewId?: string;
      hookId?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<FilterType> {
    const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [
      viewId || hookId,
    ]);
    let { list: filters } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !filters.length) {
      filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP, {
        condition: viewId ? { fk_view_id: viewId } : { fk_hook_id: hookId },
        orderBy: {
          order: 'asc',
        },
      });

      await NocoCache.setList(
        CacheScope.FILTER_EXP,
        [viewId || hookId],
        filters,
      );
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
        filter.column = await new Filter(filter).getColumn();
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

  static async deleteAll(viewId: string, ncMeta = Noco.ncMeta) {
    const filter = await this.getFilterObject({ viewId }, ncMeta);

    const deleteRecursively = async (filter) => {
      if (!filter) return;
      for (const f of filter?.children || []) await deleteRecursively(f);
      if (filter.id) {
        await ncMeta.metaDelete(null, null, MetaTable.FILTER_EXP, filter.id);
        await NocoCache.deepDel(
          CacheScope.FILTER_EXP,
          `${CacheScope.FILTER_EXP}:${filter.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
    };
    await deleteRecursively(filter);

    // on update delete any optimised single query cache
    {
      const view = await View.get(viewId, ncMeta);
      await NocoCache.delAll(
        CacheScope.SINGLE_QUERY,
        `${view.fk_model_id}:${view.id}:*`,
      );
    }
  }

  static async deleteAllByHook(hookId: string, ncMeta = Noco.ncMeta) {
    const filter = await this.getFilterObject({ hookId }, ncMeta);

    const deleteRecursively = async (filter) => {
      if (!filter) return;
      for (const f of filter?.children || []) await deleteRecursively(f);
      if (filter.id) {
        await ncMeta.metaDelete(null, null, MetaTable.FILTER_EXP, filter.id);
        await NocoCache.deepDel(
          CacheScope.FILTER_EXP,
          `${CacheScope.FILTER_EXP}:${filter.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
    };
    await deleteRecursively(filter);
  }

  public static async get(id: string, ncMeta = Noco.ncMeta) {
    let filterObj =
      id &&
      (await NocoCache.get(
        `${CacheScope.FILTER_EXP}:${id}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!filterObj) {
      filterObj = await ncMeta.metaGet2(null, null, MetaTable.FILTER_EXP, {
        id,
      });
      await NocoCache.set(`${CacheScope.FILTER_EXP}:${id}`, filterObj);
    }
    return this.castType(filterObj);
  }

  static async rootFilterList(
    { viewId }: { viewId: any },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [viewId]);
    let { list: filterObjs } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !filterObjs.length) {
      filterObjs = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP, {
        condition: { fk_view_id: viewId },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.setList(CacheScope.FILTER_EXP, [viewId], filterObjs);
    }
    return filterObjs
      ?.filter((f) => !f.fk_parent_id)
      ?.map((f) => this.castType(f));
  }

  static async rootFilterListByHook(
    { hookId }: { hookId: any },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [hookId]);
    let { list: filterObjs } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !filterObjs.length) {
      filterObjs = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP, {
        condition: { fk_hook_id: hookId },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.setList(CacheScope.FILTER_EXP, [hookId], filterObjs);
    }
    return filterObjs?.map((f) => this.castType(f));
  }

  static async parentFilterList(
    {
      parentId,
    }: {
      parentId: any;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [
      parentId,
    ]);
    let { list: filterObjs } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !filterObjs.length) {
      filterObjs = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP, {
        condition: {
          fk_parent_id: parentId,
          // fk_view_id: viewId,
        },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.setList(CacheScope.FILTER_EXP, [parentId], filterObjs);
    }
    return filterObjs?.map((f) => this.castType(f));
  }

  static async parentFilterListByHook(
    {
      hookId,
      parentId,
    }: {
      hookId: any;
      parentId: any;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [
      hookId,
      parentId,
    ]);
    let { list: filterObjs } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !filterObjs.length) {
      filterObjs = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP, {
        condition: {
          fk_parent_id: parentId,
          fk_hook_id: hookId,
        },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.setList(
        CacheScope.FILTER_EXP,
        [hookId, parentId],
        filterObjs,
      );
    }
    return filterObjs?.map((f) => this.castType(f));
  }

  static async hasEmptyOrNullFilters(baseId: string, ncMeta = Noco.ncMeta) {
    const emptyOrNullFilterObjs = await ncMeta.metaList2(
      null,
      null,
      MetaTable.FILTER_EXP,
      {
        condition: {
          base_id: baseId,
        },
        xcCondition: {
          _or: [
            {
              comparison_op: {
                eq: 'null',
              },
            },
            {
              comparison_op: {
                eq: 'notnull',
              },
            },
            {
              comparison_op: {
                eq: 'empty',
              },
            },
            {
              comparison_op: {
                eq: 'notempty',
              },
            },
          ],
        },
      },
    );
    return emptyOrNullFilterObjs.length > 0;
  }
}
