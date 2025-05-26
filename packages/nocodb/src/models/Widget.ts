import type { WidgetType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class Widget implements WidgetType {
  id?: string;
  title: string;
  description?: string;
  fk_dashboard_id: string;
  type: any; // WidgetTypes from SDK
  config?: any;
  meta?: any;
  order?: number;
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  created_at?: string;
  updated_at?: string;

  constructor(data: Widget) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    widgetId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let widget =
      widgetId &&
      (await NocoCache.get(
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
        await NocoCache.set(`${CacheScope.WIDGET}:${widget.id}`, widget);
      }
    }

    return widget && new Widget(widget);
  }

  public static async list(
    context: NcContext,
    dashboardId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.WIDGET, [
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
      await NocoCache.setList(CacheScope.WIDGET, [dashboardId], widgetsList);
    }
    widgetsList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return widgetsList?.map((w) => new Widget(w));
  }

  static async insert(
    context: NcContext,
    widget: Partial<Widget>,
    ncMeta = Noco.ncMeta,
  ) {
    let insertObj = extractProps(widget, [
      'id',
      'title',
      'description',
      'fk_dashboard_id',
      'type',
      'config',
      'meta',
      'position',
    ]);

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.WIDGETS, {
      fk_dashboard_id: widget.fk_dashboard_id,
    });

    insertObj = prepareForDb(insertObj, ['config', 'meta', 'position']);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.WIDGETS,
      insertObj,
    );

    return Widget.get(context, id, ncMeta).then(async (widget) => {
      await NocoCache.appendToList(
        CacheScope.WIDGET,
        [widget.fk_dashboard_id],
        `${CacheScope.WIDGET}:${id}`,
      );
      return widget;
    });
  }

  static async update(
    context: NcContext,
    widgetId: string,
    widget: Partial<Widget>,
    ncMeta = Noco.ncMeta,
  ) {
    let updateObj = extractProps(widget, [
      'title',
      'description',
      'type',
      'config',
      'meta',
      'order',
      'position',
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

    await NocoCache.update(`${CacheScope.WIDGET}:${widgetId}`, updateObj);

    return await this.get(context, widgetId);
  }

  static async delete(
    context: NcContext,
    widgetId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.WIDGETS,
      widgetId,
    );

    await NocoCache.deepDel(
      `${CacheScope.WIDGET}:${widgetId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.del([`${CacheScope.WIDGET}:${widgetId}`]);
  }
}
