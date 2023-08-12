import FilterCE from 'src/models/Filter';
import type { FilterType } from 'nocodb-sdk';
import Column from '~/models/Column';
import Hook from '~/models/Hook';
import View from '~/models/View';
import Noco from '~/Noco';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';

export default class Filter extends FilterCE implements FilterType {
  fk_widget_id?: string;

  public static castType(filter: Filter): Filter {
    return filter && new Filter(filter);
  }

  public castType(filter: Filter): Filter {
    return filter && new Filter(filter);
  }

  public static async insert(
    filter: Partial<FilterType> & { order?: number },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(filter, [
      'id',
      'fk_view_id',
      'fk_hook_id',
      'fk_widget_id',
      'fk_column_id',
      'comparison_op',
      'comparison_sub_op',
      'value',
      'fk_parent_id',
      'is_group',
      'logical_op',
      'project_id',
      'base_id',
      'order',
    ]);

    const referencedModelColName = filter.fk_hook_id
      ? 'fk_hook_id'
      : filter.fk_view_id
      ? 'fk_view_id'
      : 'fk_widget_id';
    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.FILTER_EXP, {
      [referencedModelColName]: filter[referencedModelColName],
    });

    if (!filter.fk_widget_id && !(filter.project_id && filter.base_id)) {
      let model: { project_id?: string; base_id?: string };
      if (filter.fk_view_id) {
        model = await View.get(filter.fk_view_id, ncMeta);
      } else if (filter.fk_hook_id) {
        model = await Hook.get(filter.fk_hook_id, ncMeta);
      } else if (filter.fk_column_id) {
        model = await Column.get({ colId: filter.fk_column_id }, ncMeta);
      } else {
        NcError.badRequest('Invalid filter');
      }
      // TODO: consider to imporve this logic
      // currently this null check is done because filters for Dashboard Widgets do not have a project_id and base_id atm
      // but just a widget_id (which is potentially not the best approach)
      if (model != null) {
        insertObj.project_id = model.project_id;
        insertObj.base_id = model.base_id;
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
    if (
      !(id && (filter.fk_view_id || filter.fk_hook_id || filter.fk_widget_id))
    ) {
      throw new Error(
        `Mandatory fields missing in FITLER_EXP cache population : id(${id}), fk_view_id(${filter.fk_view_id}), fk_hook_id(${filter.fk_hook_id}, fk_widget_id(${filter.fk_widget_id})`,
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
        if (filter.fk_widget_id) {
          p.push(
            NocoCache.appendToList(
              CacheScope.FILTER_EXP,
              [filter.fk_widget_id, filter.fk_parent_id],
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

    return new Filter(value);
  }

  // EXTRA METHODS

  static rootFilterListByWidget? = async (
    { widgetId }: { widgetId: string },
    ncMeta = Noco.ncMeta,
  ) => {
    const filterObjs = await ncMeta.metaList2(
      null,
      null,
      MetaTable.FILTER_EXP,
      {
        condition: { fk_widget_id: widgetId },
        orderBy: {
          order: 'asc',
        },
      },
    );
    return filterObjs?.map((f) => this.castType(f));
  };
}
