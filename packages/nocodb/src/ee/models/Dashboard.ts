import DashboardCE from 'src/models/Dashboard';
import { ModelTypes, PlanLimitTypes } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
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
import { CustomUrl, Source } from '~/models';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';

const logger = new Logger('Dashboard');

export default class Dashboard extends DashboardCE implements DashboardType {
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

  // shared dashboard props
  uuid?: string;
  password?: string;
  fk_custom_url_id?: string;

  widgets?: Widget[];

  constructor(data: Dashboard) {
    super(data);
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    dashboardId: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (!dashboardId) {
      return null;
    }

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
        MetaTable.MODELS,
        {
          id: dashboardId,
          type: ModelTypes.DASHBOARD,
        },
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
        MetaTable.MODELS,
        {
          condition: {
            base_id: baseId,
            type: ModelTypes.DASHBOARD,
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
    const sources = (await Source.list(context, { baseId: context.base_id }))
      .filter((c) => c.isMeta())
      .map((c) => c.id)
      .filter(Boolean);

    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.MODELS,
      {
        base_id: context.base_id,
        fk_workspace_id: context.workspace_id,
      },
      {
        _or: [{ source_id: { in: sources } }, { source_id: { eq: null } }],
      },
    );

    if (!insertObj.meta) {
      insertObj.meta = {};
    }

    (insertObj as any).type = ModelTypes.DASHBOARD;

    insertObj = prepareForDb(insertObj, ['meta']);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      insertObj,
    );

    await NocoCache.incrHashField(
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE,
      1,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

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
      'uuid',
      'password',
      'fk_custom_url_id',
    ]);

    updateObj = prepareForDb(updateObj, ['meta']);

    // update meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      updateObj,
      {
        id: dashboardId,
        type: ModelTypes.DASHBOARD,
      },
    );

    await NocoCache.update(
      `${CacheScope.DASHBOARD}:${dashboardId}`,
      prepareForResponse(updateObj),
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return this.get(context, dashboardId, ncMeta);
  }

  static async delete(
    context: NcContext,
    dashboardId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await CustomUrl.bulkDelete({
      fk_dashboard_id: dashboardId,
    });
    // Delete all widgets in this dashboard
    const widgets = await Widget.list(context, dashboardId, ncMeta);
    for (const widget of widgets) {
      await Widget.delete(context, widget.id, ncMeta);
    }

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        id: dashboardId,
        type: ModelTypes.DASHBOARD,
      },
    );

    await NocoCache.deepDel(
      `${CacheScope.DASHBOARD}:${dashboardId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    await NocoCache.incrHashField(
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE,
      -1,
    );
  }

  async getWidgets(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Widget[]> {
    return (this.widgets = await Widget.list(context, this.id, ncMeta));
  }

  static async getByUUID(
    context: NcContext,
    uuid: string,
    ncMeta = Noco.ncMeta,
  ) {
    const dashboard = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        type: ModelTypes.DASHBOARD,
        uuid,
      },
    );
    return dashboard && new Dashboard(dashboard);
  }

  static async countDashboardsInBase(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      {
        condition: {
          base_id: baseId,
          type: ModelTypes.DASHBOARD,
        },
      },
    );
  }

  static async clearFromStats(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const countsInBase = await this.countDashboardsInBase(
      context,
      baseId,
      ncMeta,
    );

    await NocoCache.incrHashField(
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE,
      -countsInBase,
    );

    return true;
  }
}
