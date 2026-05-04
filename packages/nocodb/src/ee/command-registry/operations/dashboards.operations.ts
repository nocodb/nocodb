import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Dashboard, Widget } from '~/models';
import {
  bDashboard,
  bWidget,
  dashboardActions,
  widgetActions,
} from '~/decorators/trace-command-descriptions';

// ─────────────────────────────────────────────────────────────
// Dashboard contracts
// ─────────────────────────────────────────────────────────────

const dashboardBodySchema = z.record(z.any());

const dashboardCreateSchema = z.object({
  dashboard: dashboardBodySchema,
});

export const DashboardCreateContract: OperationContract<
  typeof dashboardCreateSchema
> = {
  name: OperationName.dashboardCreate,
  version: 1,
  entity: MetaTable.DASHBOARDS,
  schema: dashboardCreateSchema,
  idField: 'dashboard',
  entityId: 'id',
  entityTitle: 'title',
  description: dashboardActions.add,
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.dashboardDelete,
      version: 1,
      params: { dashboardId: newId },
    };
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
] as const;

interface DashboardUpdateExtra {
  oldTitle?: string;
  prev?: Partial<Record<(typeof DASHBOARD_PREV_FIELDS)[number], unknown>>;
}

const dashboardUpdateSchema = z.object({
  dashboardId: z.string(),
  dashboard: dashboardBodySchema.optional(),
});

export const DashboardUpdateContract: OperationContract<
  typeof dashboardUpdateSchema,
  DashboardUpdateExtra
> = {
  name: OperationName.dashboardUpdate,
  version: 1,
  entity: MetaTable.DASHBOARDS,
  schema: dashboardUpdateSchema,
  entityId: (p) => p.dashboardId,
  entityTitle: (p) => (p.dashboard as any)?.title,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? dashboardActions.rename(ctx)
      : dashboardActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const dashboard = await Dashboard.get(context, param.dashboardId);
    if (!dashboard) return {};
    const src = dashboard as unknown as Record<string, unknown>;
    const prev: Record<string, unknown> = {};
    for (const k of DASHBOARD_PREV_FIELDS) prev[k] = src[k];
    return { extra: { oldTitle: dashboard.title, prev } };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.dashboardUpdate,
      version: 1,
      params: { dashboardId: p.dashboardId, dashboard: prev as any },
    };
  },
};

const dashboardDeleteSchema = z.object({
  dashboardId: z.string(),
  skipTrash: z.boolean().optional(),
});

export const DashboardDeleteContract: OperationContract<
  typeof dashboardDeleteSchema
> = {
  name: OperationName.dashboardDelete,
  version: 1,
  entity: MetaTable.DASHBOARDS,
  schema: dashboardDeleteSchema,
  entityId: (p) => p.dashboardId,
  description: dashboardActions.delete,
  resolveCtx: async (context, param) => {
    const dashboard = await Dashboard.get(context, param.dashboardId);
    return { entityTitle: dashboard?.title };
  },
  buildInverse: (_ctx, p) => {
    if (p.skipTrash) return null;
    return {
      name: OperationName.trashRestore,
      version: 1,
      params: { resourceType: 'dashboard', resourceId: p.dashboardId },
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Widget contracts
// ─────────────────────────────────────────────────────────────

const widgetBodySchema = z.record(z.any());

const widgetCreateSchema = z.object({
  widget: widgetBodySchema,
  dashboardId: z.string().optional(),
});

export const WidgetCreateContract: OperationContract<
  typeof widgetCreateSchema
> = {
  name: OperationName.widgetCreate,
  version: 1,
  entity: MetaTable.WIDGETS,
  schema: widgetCreateSchema,
  idField: 'widget',
  entityId: 'id',
  entityTitle: 'title',
  parentId: (p, r) =>
    p?.dashboardId ?? (p?.widget as any)?.fk_dashboard_id ?? r?.fk_dashboard_id,
  description: widgetActions.add,
  resolveCtx: async (context, param) => {
    const dashboardId =
      param?.dashboardId ?? (param?.widget as any)?.fk_dashboard_id;
    if (!dashboardId) return {};
    const dashboard = await Dashboard.get(context, dashboardId);
    return { parentEntityTitle: dashboard?.title };
  },
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.widgetDelete,
      version: 1,
      params: { widgetId: newId },
    };
  },
};

const duplicateWidgetSchema = z.object({
  widgetId: z.string(),
});

export const DuplicateWidgetContract: OperationContract<
  typeof duplicateWidgetSchema
> = {
  name: OperationName.duplicateWidget,
  version: 1,
  entity: MetaTable.WIDGETS,
  schema: duplicateWidgetSchema,
  entityId: (_p, r) => r?.id,
  parentId: (_p, r) => r?.fk_dashboard_id,
  description: ({ entityTitle, parentEntityTitle }) =>
    parentEntityTitle
      ? `Duplicate ${bWidget(entityTitle)} widget in ${bDashboard(
          parentEntityTitle,
        )}`
      : `Duplicate ${bWidget(entityTitle)} widget`,
  resolveCtx: async (context, param) => {
    const widget = await Widget.get(context, param.widgetId);
    if (!widget) return {};
    const dashboard = await Dashboard.get(context, widget.fk_dashboard_id);
    return {
      entityTitle: widget.title,
      parentEntityTitle: dashboard?.title,
    };
  },
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.widgetDelete,
      version: 1,
      params: { widgetId: newId },
    };
  },
};

// Persistable widget fields. Mirrors the extractProps list in
// `Widget.update`.
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
] as const;

interface WidgetUpdateExtra {
  oldTitle?: string;
  prev?: Partial<Record<(typeof WIDGET_PREV_FIELDS)[number], unknown>>;
}

const widgetUpdateSchema = z.object({
  widgetId: z.string(),
  widget: widgetBodySchema.optional(),
});

export const WidgetUpdateContract: OperationContract<
  typeof widgetUpdateSchema,
  WidgetUpdateExtra
> = {
  name: OperationName.widgetUpdate,
  version: 1,
  entity: MetaTable.WIDGETS,
  schema: widgetUpdateSchema,
  entityId: (p) => p.widgetId,
  parentId: (_p, r) => r?.fk_dashboard_id,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? widgetActions.rename(ctx)
      : widgetActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const widget = await Widget.get(context, param.widgetId);
    if (!widget) return {};
    const dashboard = await Dashboard.get(context, widget.fk_dashboard_id);
    const src = widget as unknown as Record<string, unknown>;
    const prev: Record<string, unknown> = {};
    for (const k of WIDGET_PREV_FIELDS) prev[k] = src[k];
    return {
      entityTitle: widget.title,
      parentEntityTitle: dashboard?.title,
      extra: { oldTitle: widget.title, prev },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.widgetUpdate,
      version: 1,
      params: { widgetId: p.widgetId, widget: prev as any },
    };
  },
};

const widgetDeleteSchema = z.object({
  widgetId: z.string(),
  skipTrash: z.boolean().optional(),
});

export const WidgetDeleteContract: OperationContract<
  typeof widgetDeleteSchema
> = {
  name: OperationName.widgetDelete,
  version: 1,
  entity: MetaTable.WIDGETS,
  schema: widgetDeleteSchema,
  entityId: (p) => p.widgetId,
  description: widgetActions.delete,
  resolveCtx: async (context, param) => {
    const widget = await Widget.get(context, param.widgetId);
    if (!widget) return {};
    const dashboard = await Dashboard.get(context, widget.fk_dashboard_id);
    return {
      entityTitle: widget.title,
      parentEntityTitle: dashboard?.title,
    };
  },
  buildInverse: (_ctx, p) => {
    if (p.skipTrash) return null;
    return {
      name: OperationName.trashRestore,
      version: 1,
      params: { resourceType: 'widget', resourceId: p.widgetId },
    };
  },
};
