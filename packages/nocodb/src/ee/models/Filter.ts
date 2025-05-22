import FilterCE from 'src/models/Filter';
import type { FilterType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Column from '~/models/Column';
import Hook from '~/models/Hook';
import View from '~/models/View';
import Noco from '~/Noco';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';

export default class Filter extends FilterCE implements FilterType {
  fk_link_col_id?: string;
  fk_value_col_id?: string;

  public static castType(filter: Filter): Filter {
    return filter && new Filter(filter);
  }

  public castType(filter: Filter): Filter {
    return filter && new Filter(filter);
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
      'fk_parent_column_id',
      'fk_column_id',
      'fk_link_col_id',
      'fk_value_col_id',
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

    let referencedModelColName = 'fk_view_id';
    if (filter.fk_hook_id) {
      referencedModelColName = 'fk_hook_id';
    } else if (filter.fk_link_col_id) {
      referencedModelColName = 'fk_link_col_id';
    } else if (filter.fk_parent_column_id) {
      referencedModelColName = 'fk_parent_column_id';
    }

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
        (filter.fk_view_id ||
          filter.fk_hook_id ||
          filter.fk_link_col_id ||
          filter.fk_parent_column_id)
      )
    ) {
      throw new Error(
        `Mandatory fields missing in FILTER_EXP cache population : id(${id}), fk_view_id(${filter.fk_view_id}), fk_link_col_id(${filter.fk_link_col_id}), fk_hook_id(${filter.fk_hook_id}, fk_parent_column_id(${filter.fk_parent_column_id})`,
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
        if (filter.fk_link_col_id) {
          p.push(
            NocoCache.appendToList(
              CacheScope.FILTER_EXP,
              [filter.fk_link_col_id],
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
          if (filter.fk_link_col_id) {
            p.push(
              NocoCache.appendToList(
                CacheScope.FILTER_EXP,
                [filter.fk_link_col_id, filter.fk_parent_id],
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
          [{ id: filter.fk_view_id }],
          ncMeta,
        );
      }
    }

    return new Filter(value);
  }

  // EXTRA METHODS

  static async rootFilterListByLink(
    context: NcContext,
    { columnId }: { columnId: any },
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      CacheScope.FILTER_EXP,
      [columnId],
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
          condition: { fk_link_col_id: columnId },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.FILTER_EXP, [columnId], filterObjs);
    }
    return filterObjs
      ?.filter((f) => !f.fk_parent_id)
      ?.map((f) => this.castType(f));
  }
}
