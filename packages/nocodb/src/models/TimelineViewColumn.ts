import type { BoolType, MetaType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { deserializeJSON } from '~/utils/serialize';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class TimelineViewColumn {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_view_id?: string;
  fk_column_id?: string;
  source_id?: string;
  show?: BoolType;
  underline?: BoolType;
  bold?: BoolType;
  italic?: BoolType;
  order?: number;
  group_by?: BoolType;
  group_by_order?: number;
  group_by_sort?: string;
  aggregation?: string;
  meta?: MetaType;

  constructor(data: TimelineViewColumn) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    timelineViewColumnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let viewColumn =
      timelineViewColumnId &&
      (await NocoCache.get(
        context,
        `${CacheScope.TIMELINE_VIEW_COLUMN}:${timelineViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.TIMELINE_VIEW_COLUMNS,
        timelineViewColumnId,
      );
      if (viewColumn) {
        viewColumn.meta =
          viewColumn.meta && typeof viewColumn.meta === 'string'
            ? JSON.parse(viewColumn.meta)
            : viewColumn.meta;

        await NocoCache.set(
          context,
          `${CacheScope.TIMELINE_VIEW_COLUMN}:${timelineViewColumnId}`,
          viewColumn,
        );
      }
    }

    return viewColumn && new TimelineViewColumn(viewColumn);
  }

  static async insert(
    context: NcContext,
    column: Partial<TimelineViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'show',
      'base_id',
      'source_id',
      'underline',
      'bold',
      'italic',
      'group_by',
      'group_by_order',
      'group_by_sort',
      'aggregation',
    ]);

    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.TIMELINE_VIEW_COLUMNS,
      {
        fk_view_id: insertObj.fk_view_id,
      },
    );

    if (!insertObj.source_id) {
      const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
      insertObj.source_id = viewRef.source_id;
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.TIMELINE_VIEW_COLUMNS,
      insertObj,
    );

    {
      const view = await View.get(context, column.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
    }

    return this.get(context, id, ncMeta).then(async (viewColumn) => {
      await NocoCache.appendToList(
        context,
        CacheScope.TIMELINE_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.TIMELINE_VIEW_COLUMN}:${id}`,
      );
      return viewColumn;
    });
  }

  public static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TimelineViewColumn[]> {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.TIMELINE_VIEW_COLUMN,
      [viewId],
    );
    let { list: viewColumns } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !viewColumns.length) {
      viewColumns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.TIMELINE_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );

      for (const viewColumn of viewColumns) {
        viewColumn.meta = deserializeJSON(viewColumn.meta);
      }

      await NocoCache.setList(
        context,
        CacheScope.TIMELINE_VIEW_COLUMN,
        [viewId],
        viewColumns,
      );
    }
    viewColumns.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return viewColumns?.map((v) => new TimelineViewColumn(v));
  }

  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<TimelineViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'show',
      'order',
      'underline',
      'bold',
      'italic',
      'group_by',
      'group_by_order',
      'group_by_sort',
      'aggregation',
    ]);

    // update meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.TIMELINE_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.TIMELINE_VIEW_COLUMN}:${columnId}`,
      updateObj,
    );

    // on view column update, delete any optimised single query cache
    {
      const viewCol = await this.get(context, columnId, ncMeta);
      const view = await View.get(context, viewCol.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(context, view.fk_model_id, [view]);
    }

    return res;
  }
}
