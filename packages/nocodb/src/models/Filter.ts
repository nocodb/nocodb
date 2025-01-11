import { UITypes } from 'nocodb-sdk';
import type {
  BoolType,
  COMPARISON_OPS,
  COMPARISON_SUB_OPS,
  FilterType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
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

  fk_workspace_id?: string;
  fk_model_id?: string;
  fk_view_id?: string;
  fk_hook_id?: string;
  fk_parent_column_id?: string;
  fk_column_id?: string;
  fk_parent_id?: string;
  fk_link_col_id?: string;
  fk_value_col_id?: string;

  comparison_op?: (typeof COMPARISON_OPS)[number];
  comparison_sub_op?: (typeof COMPARISON_SUB_OPS)[number];

  value?: string;

  logical_op?: 'and' | 'or' | 'not';
  is_group?: BoolType;
  children?: Filter[];
  base_id?: string;
  source_id?: string;
  column?: Column;
  order?: number;

  constructor(data: Filter | FilterType) {
    Object.assign(this, data);
  }

  public static castType(filter: Filter): Filter {
    return filter && new Filter(filter);
  }

  public castType(filter: Filter): Filter {
    return filter && new Filter(filter);
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
      'fk_hook_id',
      'fk_link_col_id',
      'fk_value_col_id',
      'fk_parent_column_id',
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

    const referencedModelColName = [
      'fk_parent_column_id',
      'fk_view_id',
      'fk_hook_id',
      'fk_link_col_id',
    ].find((k) => filter[k]);

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.FILTER_EXP, {
      [referencedModelColName]: filter[referencedModelColName],
    });

    if (!filter.source_id) {
      let model: { base_id?: string; source_id?: string };
      if (filter.fk_view_id && !filter.fk_parent_column_id) {
        model = await View.get(context, filter.fk_view_id, ncMeta);
      } else if (filter.fk_hook_id) {
        model = await Hook.get(context, filter.fk_hook_id, ncMeta);
      } else if (filter.fk_link_col_id) {
        model = await Column.get(
          context,
          { colId: filter.fk_link_col_id },
          ncMeta,
        );
      } else if (filter.fk_parent_column_id) {
        model = await Column.get(
          context,
          { colId: filter.fk_parent_column_id },
          ncMeta,
        );
      } else if (filter.fk_column_id) {
        model = await Column.get(
          context,
          { colId: filter.fk_column_id },
          ncMeta,
        );
      } else {
        NcError.invalidFilter(JSON.stringify(filter));
      }

      if (model != null) {
        insertObj.source_id = model.source_id;
      }
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
          this.insert(
            context,
            {
              ...f,
              fk_parent_id: row.id,
              [referencedModelColName]: filter[referencedModelColName],
            },
            ncMeta,
          ),
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
    if (
      !(
        id &&
        (filter.fk_view_id || filter.fk_hook_id || filter.fk_parent_column_id)
      )
    ) {
      throw new Error(
        `Mandatory fields missing in FILTER_EXP cache population : id(${id}), fk_view_id(${filter.fk_view_id}), fk_hook_id(${filter.fk_hook_id}), fk_parent_column_id(${filter.fk_parent_column_id})`,
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
        if (filter.fk_parent_column_id) {
          p.push(
            NocoCache.appendToList(
              CacheScope.FILTER_EXP,
              [filter.fk_parent_column_id],
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
          if (filter.fk_parent_column_id) {
            p.push(
              NocoCache.appendToList(
                CacheScope.FILTER_EXP,
                [filter.fk_parent_column_id, filter.fk_parent_id],
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
      });
    }

    // on new filter creation delete any optimised single query cache
    {
      // if not a view filter then no need to delete
      if (filter.fk_view_id) {
        const view = await View.get(context, filter.fk_view_id, ncMeta);

        await View.clearSingleQueryCache(
          context,
          view.fk_model_id,
          [view],
          ncMeta,
        );
      }
    }

    return this.castType(value);
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
      'comparison_sub_op',
      'value',
      'fk_parent_id',
      'is_group',
      'logical_op',
      'fk_value_col_id',
    ]);

    if (typeof updateObj.value === 'string')
      updateObj.value = updateObj.value.slice(0, 255);

    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      updateObj,
      id,
    );

    await NocoCache.update(`${CacheScope.FILTER_EXP}:${id}`, updateObj);

    // on update delete any optimised single query cache
    {
      const filter = await this.get(context, id, ncMeta);
      // if not a view filter then no need to delete
      if (filter.fk_view_id) {
        const view = await View.get(context, filter.fk_view_id, ncMeta);
        await View.clearSingleQueryCache(
          context,
          view.fk_model_id,
          [{ id: filter.fk_view_id }],
          ncMeta,
        );
      }
    }

    return res;
  }

  static async delete(context: NcContext, id: string, ncMeta = Noco.ncMeta) {
    const filter = await this.get(context, id, ncMeta);

    const deleteRecursively = async (filter: Filter) => {
      if (!filter || filter.id === filter.fk_parent_id) return;
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

    // delete any optimised single query cache
    {
      // if not a view filter then no need to delete
      if (filter.fk_view_id) {
        const view = await View.get(context, filter.fk_view_id, ncMeta);

        await View.clearSingleQueryCache(
          context,
          view.fk_model_id,
          [{ id: filter.fk_view_id }],
          ncMeta,
        );
      }
    }
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

  public async getGroup(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Filter> {
    if (!this.fk_parent_id) return null;
    let filterObj = await NocoCache.get(
      `${CacheScope.FILTER_EXP}:${this.fk_parent_id}`,
      2,
    );
    if (!filterObj) {
      filterObj = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          id: this.fk_parent_id,
        },
      );
      await NocoCache.set(
        `${CacheScope.FILTER_EXP}:${this.fk_parent_id}`,
        filterObj,
      );
    }
    return this.castType(filterObj);
  }

  public async getChildren(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Filter[]> {
    if (this.children) return this.children;
    if (!this.is_group) return null;
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [this.id],
      {
        key: 'order',
      },
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
          orderBy: {
            order: 'asc',
          },
        },
      );
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
      hookId,
      linkColId,
      parentColId,
    }: {
      viewId?: string;
      hookId?: string;
      linkColId?: string;
      parentColId?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<FilterType> {
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [parentColId || viewId || hookId || linkColId],
      {
        key: 'order',
      },
    );
    let { list: filters } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !filters.length) {
      const condition: Record<string, string> = {};

      if (viewId && !parentColId) {
        condition.fk_view_id = viewId;
      } else if (hookId) {
        condition.fk_hook_id = hookId;
      } else if (linkColId) {
        condition.fk_link_col_id = linkColId;
      } else if (parentColId) {
        condition.fk_parent_column_id = parentColId;
      }

      filters = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          condition,
          orderBy: {
            order: 'asc',
          },
        },
      );

      await NocoCache.setList(
        CacheScope.FILTER_EXP,
        [parentColId || viewId || hookId || linkColId],
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
        filter.column = await new Filter(filter).getColumn(context, ncMeta);
        if (filter.column?.uidt === UITypes.LinkToAnotherRecord) {
        }
      }
    }

    for (const [id, children] of Object.entries(grouped)) {
      if (idFilterMapping?.[id]) idFilterMapping[id].children = children;
    }

    return result;
  }

  static async deleteAll(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const filter = await this.getFilterObject(context, { viewId }, ncMeta);

    const deleteRecursively = async (filter) => {
      if (!filter) return;
      for (const f of filter?.children || []) await deleteRecursively(f);
      if (filter.id) {
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
      }
    };
    await deleteRecursively(filter);

    // on update delete any optimised single query cache
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

  static async deleteAllByHook(
    context: NcContext,
    hookId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const filter = await this.getFilterObject(context, { hookId }, ncMeta);

    const deleteRecursively = async (filter) => {
      if (!filter) return;
      for (const f of filter?.children || []) await deleteRecursively(f);
      if (filter.id) {
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
      }
    };
    await deleteRecursively(filter);
  }

  static async deleteAllByParentColumn(
    context: NcContext,
    parentColId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const filter = await this.getFilterObject(context, { parentColId }, ncMeta);

    const deleteRecursively = async (filter) => {
      if (!filter) return;
      for (const f of filter?.children || []) await deleteRecursively(f);
      if (filter.id) {
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
      }
    };
    await deleteRecursively(filter);
  }

  public static async get(
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
    return this.castType(filterObj);
  }

  static async allViewFilterList(
    context: NcContext,
    { viewId }: { viewId: string },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [viewId]);
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

    return filterObjs?.map((f) => this.castType(f)) || [];
  }

  static async allHookFilterList(
    context: NcContext,
    { hookId }: { hookId: string },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [hookId]);
    let { list: filterObjs } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !filterObjs.length) {
      filterObjs = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          condition: { fk_hook_id: hookId },
        },
      );
      await NocoCache.setList(CacheScope.FILTER_EXP, [hookId], filterObjs);
    }

    return filterObjs?.map((f) => this.castType(f)) || [];
  }

  static async rootFilterList(
    context: NcContext,
    { viewId }: { viewId: string },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [viewId],
      {
        key: 'order',
      },
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
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.FILTER_EXP, [viewId], filterObjs);
    }

    return filterObjs
      ?.filter((f) => !f.fk_parent_id)
      ?.map((f) => this.castType(f));
  }

  static async rootFilterListByHook(
    context: NcContext,
    { hookId }: { hookId: string },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [hookId],
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
          condition: { fk_hook_id: hookId },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.FILTER_EXP, [hookId], filterObjs);
    }
    return filterObjs
      ?.filter((f) => !f.fk_parent_id)
      ?.map((f) => this.castType(f));
  }

  static async rootFilterListByParentColumn(
    context: NcContext,
    { parentColId }: { parentColId: string },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [parentColId],
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
          condition: { fk_parent_column_id: parentColId },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.FILTER_EXP, [parentColId], filterObjs);
    }
    return filterObjs
      ?.filter((f) => !f.fk_parent_id)
      ?.map((f) => this.castType(f));
  }

  static async parentFilterList(
    context: NcContext,
    {
      parentId,
    }: {
      parentId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [parentId],
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
          condition: {
            fk_parent_id: parentId,
            // fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.FILTER_EXP, [parentId], filterObjs);
    }
    return filterObjs?.map((f) => this.castType(f));
  }

  static async parentFilterListByHook(
    context: NcContext,
    {
      hookId,
      parentId,
    }: {
      hookId: string;
      parentId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [hookId, parentId],
      {
        key: 'order',
      },
    );
    let { list: filterObjs } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !filterObjs.length) {
      filterObjs = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          condition: {
            fk_parent_id: parentId,
            fk_hook_id: hookId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(
        CacheScope.FILTER_EXP,
        [hookId, parentId],
        filterObjs,
      );
    }
    return filterObjs?.map((f) => this.castType(f));
  }

  static async parentFilterListByParentColumn(
    context: NcContext,
    {
      parentColId,
      parentId,
    }: {
      parentColId: string;
      parentId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [parentColId, parentId],
      {
        key: 'order',
      },
    );
    let { list: filterObjs } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !filterObjs.length) {
      filterObjs = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          condition: {
            fk_parent_id: parentId,
            fk_parent_column_id: parentColId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(
        CacheScope.FILTER_EXP,
        [parentColId, parentId],
        filterObjs,
      );
    }
    return filterObjs?.map((f) => this.castType(f));
  }

  static async hasEmptyOrNullFilters(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const emptyOrNullFilterObjs = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
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

  static async rootFilterListByLink(
    _context: NcContext,
    { columnId: _columnId }: { columnId: string },
    _ncMeta = Noco.ncMeta,
  ) {
    return [];
  }

  static async allLinkFilterList(
    context: NcContext,
    { linkColumnId }: { linkColumnId: string },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.FILTER_EXP, [
      linkColumnId,
    ]);
    let { list: filterObjs } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !filterObjs.length) {
      filterObjs = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          condition: { fk_link_col_id: linkColumnId },
        },
      );
      await NocoCache.setList(
        CacheScope.FILTER_EXP,
        [linkColumnId],
        filterObjs,
      );
    }

    return filterObjs?.map((f) => this.castType(f)) || [];
  }

  static async updateAllChildrenLogicalOp(
    context: NcContext,
    {
      parentFilterId,
      logicalOp,
      viewId,
    }: { viewId: string; parentFilterId: string; logicalOp: 'and' | 'or' },
    ncMeta = Noco.ncMeta,
  ) {
    let filters;
    if (parentFilterId === 'root') {
      filters = await Filter.rootFilterList(context, { viewId }, ncMeta);
    } else {
      const filter = await this.get(context, parentFilterId);
      if (!filter.is_group) {
        return;
      }
      filters = await filter.getChildren(context, ncMeta);
    }

    for (const child of filters || []) {
      await Filter.update(context, child.id, { logical_op: logicalOp }, ncMeta);
    }
  }

  async extractRelatedParentMetas(context, ncMeta = Noco.ncMeta) {
    let parentData:
      | {
          view: View;
        }
      | {
          hook: Hook;
        }
      | {
          linkColumn: Column;
        };

    if (this.fk_view_id) {
      parentData = { view: await View.get(context, this.fk_view_id, ncMeta) };
    } else if (this.fk_hook_id) {
      parentData = { hook: await Hook.get(context, this.fk_hook_id, ncMeta) };
    } else if (this.fk_link_col_id) {
      parentData = {
        linkColumn: await Column.get(
          context,
          { colId: this.fk_link_col_id },
          ncMeta,
        ),
      };
    }

    return parentData;
  }
}
