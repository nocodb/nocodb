import type { BoolType, MetaType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { deserializeJSON } from '~/utils/serialize';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class CalendarViewColumn {
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
  meta?: MetaType;

  constructor(data: CalendarViewColumn) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    calendarViewColumnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let viewColumn =
      calendarViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.CALENDAR_VIEW_COLUMN}:${calendarViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW_COLUMNS,
        calendarViewColumnId,
      );
      if (viewColumn) {
        viewColumn.meta =
          viewColumn.meta && typeof viewColumn.meta === 'string'
            ? JSON.parse(viewColumn.meta)
            : viewColumn.meta;

        await NocoCache.set(
          `${CacheScope.CALENDAR_VIEW_COLUMN}:${calendarViewColumnId}`,
          viewColumn,
        );
      }
    }

    return viewColumn && new CalendarViewColumn(viewColumn);
  }

  static async insert(
    context: NcContext,
    column: Partial<CalendarViewColumn>,
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
    ]);

    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.CALENDAR_VIEW_COLUMNS,
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
      MetaTable.CALENDAR_VIEW_COLUMNS,
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
        CacheScope.CALENDAR_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.CALENDAR_VIEW_COLUMN}:${id}`,
      );
      return viewColumn;
    });
  }

  public static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<CalendarViewColumn[]> {
    const cachedList = await NocoCache.getList(
      CacheScope.CALENDAR_VIEW_COLUMN,
      [viewId],
    );
    let { list: viewColumns } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !viewColumns.length) {
      viewColumns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW_COLUMNS,
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
        CacheScope.CALENDAR_VIEW_COLUMN,
        [viewId],
        viewColumns,
      );
    }
    viewColumns.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return viewColumns?.map((v) => new CalendarViewColumn(v));
  }

  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<CalendarViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'show',
      'order',
      'underline',
      'bold',
      'italic',
    ]);

    // update meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    await NocoCache.update(
      `${CacheScope.CALENDAR_VIEW_COLUMN}:${columnId}`,
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
