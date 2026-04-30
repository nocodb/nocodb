import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/_types';
import { OperationName } from '~/command-registry/_op-names';
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
};

const dashboardUpdateSchema = z.object({
  dashboardId: z.string(),
  dashboard: dashboardBodySchema.optional(),
});

export const DashboardUpdateContract: OperationContract<
  typeof dashboardUpdateSchema
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
    return { extra: { oldTitle: dashboard?.title } };
  },
};

const dashboardDeleteSchema = z.object({
  dashboardId: z.string(),
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
};

const widgetUpdateSchema = z.object({
  widgetId: z.string(),
  widget: widgetBodySchema.optional(),
});

export const WidgetUpdateContract: OperationContract<
  typeof widgetUpdateSchema
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
    return {
      entityTitle: widget.title,
      parentEntityTitle: dashboard?.title,
      extra: { oldTitle: widget.title },
    };
  },
};

const widgetDeleteSchema = z.object({
  widgetId: z.string(),
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
};
