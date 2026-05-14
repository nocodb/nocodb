import type { OperationContract } from '~/command-registry/types';
import type { DashboardsService } from '~/services/dashboards.service';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import BaseTrash from '~/models/BaseTrash';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import {
  dynamicScope,
  scopeBase,
  scopeDashboard,
} from '~/command-registry/scope';
import { isReplay, setReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { Dashboard, Widget } from '~/models';
import { pickFields } from '~/utils/tsUtils';
import {
  bDashboard,
  bWidget,
  dashboardActions,
  widgetActions,
} from '~/decorators/trace-command-descriptions';
import {
  dashboardCreateSchema,
  dashboardDeleteSchema,
  dashboardUpdateSchema,
  duplicateWidgetSchema,
  widgetCreateSchema,
  widgetDeleteSchema,
  widgetUpdateSchema,
} from '~/command-registry/operations/_schemas/dashboard';

export const DashboardCreateContract: OperationContract<
  typeof dashboardCreateSchema
> = {
  name: OperationName.dashboardCreate,
  entity: MetaTable.DASHBOARDS,
  schema: dashboardCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: 'title',
    description: dashboardActions.add,
  },
  sandbox: { id_field: 'dashboard' },
  undo: {
    inverse: (_context, _params, result) => {
      const newId = (result as { id?: string } | undefined)?.id;
      if (!newId) return null;
      return {
        name: OperationName.dashboardDelete,
        params: { dashboardId: newId },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

const DASHBOARD_PREV_FIELDS = [
  'title',
  'description',
  'order',
  'meta',
  'owned_by',
  'uuid',
  'password',
  'fk_custom_url_id',
] as const satisfies readonly (keyof Dashboard)[];

type DashboardPrev = Pick<Dashboard, (typeof DASHBOARD_PREV_FIELDS)[number]>;

interface DashboardUpdateExtra {
  oldTitle?: string;
  prev?: DashboardPrev;
}

export const DashboardUpdateContract: OperationContract<
  typeof dashboardUpdateSchema,
  DashboardUpdateExtra
> = {
  name: OperationName.dashboardUpdate,
  entity: MetaTable.DASHBOARDS,
  schema: dashboardUpdateSchema,
  entry: {
    entity_id: (params) => params.dashboardId,
    entity_title: (params) => params.dashboard?.title,
    description: (context) =>
      context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
        ? dashboardActions.rename(context)
        : dashboardActions.edit(context),
    before: async (context, params) => {
      const dashboard = await Dashboard.get(context, params.dashboardId);
      if (!dashboard) return {};
      return {
        extra: {
          oldTitle: dashboard.title,
          prev: pickFields(dashboard, DASHBOARD_PREV_FIELDS),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      return {
        name: OperationName.dashboardUpdate,
        params: { dashboardId: params.dashboardId, dashboard: prev },
      };
    },
    // Dynamic: title-only edits (sidebar rename) → base stack; any other
    // body field (layout, settings) → dashboard stack.
    scope: (params, _r, _resolved, context) =>
      dynamicScope(
        'dashboardUpdate',
        params.dashboard as Record<string, unknown>,
        scopeBase(context),
        scopeDashboard(params.dashboardId),
      ),
  },
};

export const DashboardDeleteContract: OperationContract<
  typeof dashboardDeleteSchema
> = {
  name: OperationName.dashboardDelete,
  entity: MetaTable.DASHBOARDS,
  schema: dashboardDeleteSchema,
  entry: {
    entity_id: (params) => params.dashboardId,
    description: dashboardActions.delete,
    before: async (context, params) => {
      const dashboard = await Dashboard.get(context, params.dashboardId);
      return { entityTitle: dashboard?.title };
    },
  },
  undo: {
    inverse: (_context, params) => {
      if (params.skipTrash) return null;
      return {
        name: OperationName.trashRestore,
        params: { resourceType: 'dashboard', resourceId: params.dashboardId },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export const WidgetCreateContract: OperationContract<
  typeof widgetCreateSchema
> = {
  name: OperationName.widgetCreate,
  entity: MetaTable.WIDGETS,
  schema: widgetCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: 'title',
    parent_id: (params, result) =>
      params?.dashboardId ??
      params?.widget?.fk_dashboard_id ??
      (result as { fk_dashboard_id?: string } | undefined)?.fk_dashboard_id,
    description: widgetActions.add,
    before: async (context, params) => {
      const dashboardId =
        params?.dashboardId ?? params?.widget?.fk_dashboard_id;
      if (!dashboardId) return {};
      const dashboard = await Dashboard.get(context, dashboardId);
      return { parentEntityTitle: dashboard?.title };
    },
  },
  sandbox: { id_field: 'widget' },
  undo: {
    inverse: (_context, _params, result) => {
      const newId = (result as { id?: string } | undefined)?.id;
      if (!newId) return null;
      return {
        name: OperationName.widgetDelete,
        params: { widgetId: newId },
      };
    },
    scope: (params, result) =>
      scopeDashboard(
        params?.dashboardId ??
          params?.widget?.fk_dashboard_id ??
          (result as { fk_dashboard_id?: string } | undefined)?.fk_dashboard_id,
      ),
  },
};

export const DuplicateWidgetContract: OperationContract<
  typeof duplicateWidgetSchema
> = {
  name: OperationName.duplicateWidget,
  entity: MetaTable.WIDGETS,
  schema: duplicateWidgetSchema,
  entry: {
    entity_id: (_params, result) => (result as { id?: string } | undefined)?.id,
    parent_id: (_params, result) =>
      (result as { fk_dashboard_id?: string } | undefined)?.fk_dashboard_id,
    description: ({ entityTitle, parentEntityTitle }) =>
      parentEntityTitle
        ? `Duplicate ${bWidget(entityTitle)} widget in ${bDashboard(
            parentEntityTitle,
          )}`
        : `Duplicate ${bWidget(entityTitle)} widget`,
    before: async (context, params) => {
      const widget = await Widget.get(context, params.widgetId);
      if (!widget) return {};
      const dashboard = await Dashboard.get(context, widget.fk_dashboard_id);
      return {
        entityTitle: widget.title,
        parentEntityTitle: dashboard?.title,
        extra: { fkDashboardId: widget.fk_dashboard_id },
      };
    },
  },
  undo: {
    inverse: (_context, _params, result) => {
      const newId = (result as { id?: string } | undefined)?.id;
      if (!newId) return null;
      return {
        name: OperationName.widgetDelete,
        params: { widgetId: newId },
      };
    },
    scope: (_p, result, resolved) =>
      scopeDashboard(
        (result as { fk_dashboard_id?: string } | undefined)?.fk_dashboard_id ??
          (resolved?.extra as { fkDashboardId?: string } | undefined)
            ?.fkDashboardId,
      ),
  },
};

// Mirrors `Widget.update`'s extractProps list.
const WIDGET_PREV_FIELDS = [
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
] as const satisfies readonly (keyof Widget)[];

type WidgetPrev = Pick<Widget, (typeof WIDGET_PREV_FIELDS)[number]>;

interface WidgetUpdateExtra {
  oldTitle?: string;
  prev?: WidgetPrev;
  fkDashboardId?: string;
}

export const WidgetUpdateContract: OperationContract<
  typeof widgetUpdateSchema,
  WidgetUpdateExtra
> = {
  name: OperationName.widgetUpdate,
  entity: MetaTable.WIDGETS,
  schema: widgetUpdateSchema,
  entry: {
    entity_id: (params) => params.widgetId,
    parent_id: (_params, result) =>
      (result as { fk_dashboard_id?: string } | undefined)?.fk_dashboard_id,
    description: (context) =>
      context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
        ? widgetActions.rename(context)
        : widgetActions.edit(context),
    before: async (context, params) => {
      const widget = await Widget.get(context, params.widgetId);
      if (!widget) return {};
      const dashboard = await Dashboard.get(context, widget.fk_dashboard_id);
      return {
        entityTitle: widget.title,
        parentEntityTitle: dashboard?.title,
        extra: {
          oldTitle: widget.title,
          prev: pickFields(widget, WIDGET_PREV_FIELDS),
          fkDashboardId: widget.fk_dashboard_id,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      return {
        name: OperationName.widgetUpdate,
        params: { widgetId: params.widgetId, widget: prev },
      };
    },
    scope: (_p, result, resolved) =>
      scopeDashboard(
        (result as { fk_dashboard_id?: string } | undefined)?.fk_dashboard_id ??
          resolved?.extra?.fkDashboardId,
      ),
  },
};

interface WidgetDeleteExtra {
  fkDashboardId?: string;
}

export const WidgetDeleteContract: OperationContract<
  typeof widgetDeleteSchema,
  WidgetDeleteExtra
> = {
  name: OperationName.widgetDelete,
  entity: MetaTable.WIDGETS,
  schema: widgetDeleteSchema,
  entry: {
    entity_id: (params) => params.widgetId,
    description: widgetActions.delete,
    before: async (context, params) => {
      const widget = await Widget.get(context, params.widgetId);
      if (!widget) return {};
      const dashboard = await Dashboard.get(context, widget.fk_dashboard_id);
      return {
        entityTitle: widget.title,
        parentEntityTitle: dashboard?.title,
        extra: { fkDashboardId: widget.fk_dashboard_id },
      };
    },
  },
  undo: {
    inverse: (_context, params) => {
      if (params.skipTrash) return null;
      return {
        name: OperationName.trashRestore,
        params: { resourceType: 'widget', resourceId: params.widgetId },
      };
    },
    scope: (_p, _r, resolved) => scopeDashboard(resolved?.extra?.fkDashboardId),
  },
};

export function registerDashboardHandlers(
  svc: DashboardsService,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(
    DashboardCreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'dashboard',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(context, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }
      return svc.dashboardCreate(context, {
        ...params,
        req,
      } as Parameters<typeof svc.dashboardCreate>[1]);
    },
  );

  registerForward(DashboardUpdateContract, (context, params) =>
    svc.dashboardUpdate(context, params),
  );
  registerForward(DashboardDeleteContract, (context, params) =>
    svc.dashboardDelete(context, params),
  );

  OperationRegistry.register(
    WidgetCreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'widget',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(context, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }
      return svc.widgetCreate(context, {
        ...params,
        req,
      } as Parameters<typeof svc.widgetCreate>[1]);
    },
  );

  // duplicateWidget params carry only the source id; replay threads the
  // recorded entity_id via ALS so the destination keeps the sandbox id.
  OperationRegistry.register(
    DuplicateWidgetContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'widget',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(context, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }
      if (isReplay() && meta.entityId) {
        setReplay('replayDuplicateId', meta.entityId);
      }
      return svc.duplicateWidget(context, {
        ...params,
        req,
      } as Parameters<typeof svc.duplicateWidget>[1]);
    },
  );

  registerForward(WidgetUpdateContract, (context, params) =>
    svc.widgetUpdate(context, params),
  );
  registerForward(WidgetDeleteContract, (context, params) =>
    svc.widgetDelete(context, params),
  );
}
