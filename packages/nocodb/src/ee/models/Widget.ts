import type { IWidget, WidgetTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import { Filter } from '~/models';
export default class Widget implements IWidget {
  id?: string;
  title: string;
  description?: string;
  fk_dashboard_id: string;
  type: WidgetTypes;
  config?: any;
  meta?: any;
  order?: number;
  fk_model_id?: string;
  fk_view_id?: string;
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  error?: boolean;

  base_id: string;
  fk_workspace_id: string;
  created_at?: string;
  updated_at?: string;

  constructor(data: Widget) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    widgetId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Widget | null> {
    let widget =
      widgetId &&
      (await NocoCache.get(
        context,
        `${CacheScope.WIDGET}:${widgetId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!widget) {
      widget = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.WIDGETS,
        widgetId,
      );
      if (widget) {
        widget = prepareForResponse(widget, ['config', 'meta', 'position']);
        await NocoCache.set(
          context,
          `${CacheScope.WIDGET}:${widget.id}`,
          widget,
        );
      }
    }

    // If called from extractIds middleware, we don't want to fetch filters
    if (
      widget &&
      context.workspace_id !== RootScopes.BYPASS &&
      context.base_id !== RootScopes.BYPASS
    ) {
      widget.filters = await Filter.rootFilterListByWidget(context, {
        widgetId: widget.id,
      });
    }

    return widget && new Widget(widget);
  }

  public static async list(
    context: NcContext,
    dashboardId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Widget[]> {
    const cachedList = await NocoCache.getList(context, CacheScope.WIDGET, [
      dashboardId,
    ]);
    let { list: widgetsList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !widgetsList.length) {
      widgetsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.WIDGETS,
        {
          condition: {
            fk_dashboard_id: dashboardId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      for (let widget of widgetsList) {
        widget = prepareForResponse(widget, ['config', 'meta', 'position']);
      }
      await NocoCache.setList(
        context,
        CacheScope.WIDGET,
        [dashboardId],
        widgetsList,
      );
      widgetsList.sort(
        (a, b) =>
          (a.order != null ? a.order : Infinity) -
          (b.order != null ? b.order : Infinity),
      );
    }

    if (!widgetsList.length) {
      return [];
    }

    for (const widget of widgetsList) {
      widget.filters = await Filter.rootFilterListByWidget(context, {
        widgetId: widget.id,
      });
    }

    return widgetsList;
  }

  static async insert(
    context: NcContext,
    widget: Partial<Widget>,
    ncMeta = Noco.ncMeta,
  ): Promise<Widget> {
    let insertObj = extractProps(widget, [
      'id',
      'title',
      'description',
      'fk_dashboard_id',
      'type',
      'config',
      'meta',
      'position',
      'fk_model_id',
      'fk_view_id',
      'error',
    ]);

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.WIDGETS, {
      fk_dashboard_id: widget.fk_dashboard_id,
    });

    insertObj = prepareForDb(insertObj, ['config', 'meta', 'position']);

    const insertRes = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.WIDGETS,
      insertObj,
    );

    return Widget.get(context, insertRes.id, ncMeta).then(async (widget) => {
      await NocoCache.appendToList(
        context,
        CacheScope.WIDGET,
        [widget.fk_dashboard_id],
        `${CacheScope.WIDGET}:${insertRes.id}`,
      );
      return widget;
    });
  }

  static async update(
    context: NcContext,
    widgetId: string,
    widget: Partial<Widget>,
    ncMeta = Noco.ncMeta,
  ): Promise<Widget> {
    let updateObj = extractProps(widget, [
      'title',
      'description',
      'type',
      'config',
      'meta',
      'order',
      'position',
      'fk_model_id',
      'fk_view_id',
      'error',
    ]);

    updateObj = prepareForDb(updateObj, ['config', 'meta', 'position']);

    // update meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.WIDGETS,
      prepareForDb(updateObj),
      widgetId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.WIDGET}:${widgetId}`,
      prepareForResponse(updateObj, ['config', 'meta', 'position']),
    );

    return await this.get(context, widgetId);
  }

  static async delete(
    context: NcContext,
    widgetId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.WIDGETS,
      widgetId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.WIDGET}:${widgetId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    const filters = await Filter.rootFilterListByWidget(context, {
      widgetId: widgetId,
    });
    for (const filter of filters) {
      await Filter.delete(context, filter.id);
    }
  }
}
