import type { DashboardType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Widget from '~/models/Widget';
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

export default class Dashboard implements DashboardType {
  id?: string;
  title: string;
  description?: string;
  base_id: string;
  fk_workspace_id?: string;
  meta?: any;
  order?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  owned_by?: string;

  widgets?: Widget[];

  constructor(data: Dashboard) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    dashboardId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let dashboard =
      dashboardId &&
      (await NocoCache.get(
        `${CacheScope.DASHBOARD}:${dashboardId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!dashboard) {
      dashboard = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.DASHBOARDS,
        dashboardId,
      );
      if (dashboard) {
        dashboard = prepareForResponse(dashboard, ['meta']);
        await NocoCache.set(
          `${CacheScope.DASHBOARD}:${dashboard.id}`,
          dashboard,
        );
      }
    }

    return dashboard && new Dashboard(dashboard);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.DASHBOARD, [baseId]);
    let { list: dashboardsList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !dashboardsList.length) {
      dashboardsList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.DASHBOARDS,
        {
          condition: {
            base_id: baseId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      for (let dashboard of dashboardsList) {
        dashboard = prepareForResponse(dashboard, ['meta']);
      }
      await NocoCache.setList(CacheScope.DASHBOARD, [baseId], dashboardsList);
    }
    dashboardsList.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return dashboardsList?.map((d) => new Dashboard(d));
  }

  static async insert(
    context: NcContext,
    dashboard: Partial<Dashboard>,
    ncMeta = Noco.ncMeta,
  ) {
    let insertObj = extractProps(dashboard, [
      'id',
      'title',
      'description',
      'base_id',
      'meta',
      'created_by',
      'owned_by',
    ]);

    // get order value
    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.DASHBOARDS, {
      base_id: context.base_id,
      fk_workspace_id: context.workspace_id,
    });

    if (!insertObj.meta) {
      insertObj.meta = {};
    }

    insertObj = prepareForDb(insertObj, ['meta']);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.DASHBOARDS,
      insertObj,
    );

    return Dashboard.get(context, id, ncMeta).then(async (dashboard) => {
      await NocoCache.appendToList(
        CacheScope.DASHBOARD,
        [context.base_id],
        `${CacheScope.DASHBOARD}:${id}`,
      );
      return dashboard;
    });
  }

  static async update(
    context: NcContext,
    dashboardId: string,
    dashboard: Partial<Dashboard>,
    ncMeta = Noco.ncMeta,
  ) {
    let updateObj = extractProps(dashboard, [
      'title',
      'description',
      'order',
      'meta',
      'owned_by',
    ]);

    updateObj = prepareForDb(updateObj, ['meta']);

    // update meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.DASHBOARDS,
      updateObj,
      dashboardId,
    );

    await NocoCache.update(
      `${CacheScope.DASHBOARD}:${dashboardId}`,
      prepareForResponse(updateObj),
    );

    return this.get(context, dashboardId, ncMeta);
  }

  static async delete(
    context: NcContext,
    dashboardId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Delete all widgets in this dashboard
    const widgets = await Widget.list(context, dashboardId, ncMeta);
    for (const widget of widgets) {
      await Widget.delete(context, widget.id, ncMeta);
    }

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DASHBOARDS,
      dashboardId,
    );

    await NocoCache.deepDel(
      `${CacheScope.DASHBOARD}:${dashboardId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.del([`${CacheScope.DASHBOARD}:${dashboardId}`]);
  }

  async getWidgets(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Widget[]> {
    return (this.widgets = await Widget.list(context, this.id, ncMeta));
  }
}
