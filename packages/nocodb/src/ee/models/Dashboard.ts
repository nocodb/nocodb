import DashboardCE from 'src/models/Dashboard';
import { ModelTypes, PlanLimitTypes } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
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
import { notDeletedXcCondition } from '~/utils/trashUtils';
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
    includeDeleted = false,
    ncMeta = Noco.ncMeta,
  ) {
    if (!dashboardId) {
      return null;
    }

    let dashboard =
      dashboardId &&
      (await NocoCache.get(
        context,
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
          context,
          `${CacheScope.DASHBOARD}:${dashboard.id}`,
          dashboard,
        );
      }
    }

    if (dashboard?.deleted && !includeDeleted) return null;

    return dashboard && new Dashboard(dashboard);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    includeDeleted = false,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(context, CacheScope.DASHBOARD, [
      baseId,
    ]);
    let dashboardsList = cachedList.list;
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
      await NocoCache.setList(
        context,
        CacheScope.DASHBOARD,
        [baseId],
        dashboardsList,
      );
    }

    if (!includeDeleted) {
      dashboardsList = dashboardsList.filter((d) => !d.deleted);
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
      'order',
      'created_by',
      'owned_by',
    ]);

    // Preserve order if provided; otherwise calculate next order
    if (insertObj.order === undefined || insertObj.order === null) {
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
    }

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
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE,
      1,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return Dashboard.get(context, id, false, ncMeta).then(async (dashboard) => {
      await NocoCache.appendToList(
        context,
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

    // Hash password if being set
    if (updateObj.password) {
      updateObj.password = await bcrypt.hash(updateObj.password, 10);
    }

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
      context,
      `${CacheScope.DASHBOARD}:${dashboardId}`,
      prepareForResponse(updateObj),
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return this.get(context, dashboardId, false, ncMeta);
  }

  static async verifyPassword(
    dashboard: { password?: string },
    inputPassword: string,
  ): Promise<boolean> {
    if (!dashboard.password) return true;
    if (!inputPassword) return false;

    // Support bcrypt hashed passwords
    if (
      dashboard.password.startsWith('$2a$') ||
      dashboard.password.startsWith('$2b$')
    ) {
      return bcrypt.compare(inputPassword, dashboard.password);
    }

    // Plaintext fallback for pre-migration passwords
    return dashboard.password === inputPassword;
  }

  static async softDelete(
    context: NcContext,
    dashboardId: string,
    deleted: boolean,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MODELS,
      { deleted },
      dashboardId,
    );
    await NocoCache.update(context, `${CacheScope.DASHBOARD}:${dashboardId}`, {
      deleted,
    });

    // Adjust workspace resource stats cache: -1 on trash, +1 on restore
    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE,
      deleted ? -1 : 1,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });
  }

  static async delete(
    context: NcContext,
    dashboardId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await CustomUrl.bulkDelete({
      fk_dashboard_id: dashboardId,
    });
    // Delete all widgets in this dashboard (including soft-deleted)
    const widgets = await Widget.list(context, dashboardId, true, ncMeta);
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
      context,
      `${CacheScope.DASHBOARD}:${dashboardId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_DASHBOARD_PER_WORKSPACE,
      -1,
    );
  }

  async getWidgets(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<Widget[]> {
    return (this.widgets = await Widget.list(context, this.id, false, ncMeta));
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
      undefined,
      notDeletedXcCondition,
    );
    return dashboard && new Dashboard(prepareForResponse(dashboard, ['meta']));
  }

  static async deleteByBaseId(
    context: NcContext,
    base_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const dashboards = await this.list(context, base_id, true, ncMeta);

    for (const dashboard of dashboards) {
      await this.delete(context, dashboard.id, ncMeta);
    }

    return true;
  }
}
