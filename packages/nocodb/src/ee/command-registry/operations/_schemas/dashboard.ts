import { z } from 'zod';

const boolType = z.union([z.boolean(), z.literal(0), z.literal(1), z.null()]);

export const dashboardBodySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    meta: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
    order: z.number().int().nonnegative().optional(),
    owned_by: z.string().nullable().optional(),
    uuid: z.string().nullable().optional(),
    password: z.string().nullable().optional(),
    fk_custom_url_id: z.string().nullable().optional(),

    // Replay-time injection (idField: 'dashboard')
    id: z.string().optional(),
  })
  .strict();

export const dashboardCreateSchema = z
  .object({
    dashboard: dashboardBodySchema,
  })
  .strict();

export const dashboardUpdateSchema = z
  .object({
    dashboardId: z.string(),
    dashboard: dashboardBodySchema,
  })
  .strict();

export const dashboardDeleteSchema = z
  .object({
    dashboardId: z.string(),
    skipTrash: z.boolean().optional(),
  })
  .strict();

const jsonOrText = z.union([z.record(z.unknown()), z.string(), z.null()]);

export const widgetBodySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    type: z.string().optional(),
    fk_dashboard_id: z.string().optional(),
    fk_model_id: z.string().nullable().optional(),
    fk_view_id: z.string().nullable().optional(),
    config: jsonOrText.optional(),
    meta: jsonOrText.optional(),
    position: jsonOrText.optional(),
    order: z.number().int().nonnegative().optional(),
    error: boolType.optional(),

    // Replay-time injection (idField: 'widget')
    id: z.string().optional(),

    // Filters bundled at create-time (atomic save).
    filters: z.array(z.record(z.unknown())).optional(),
  })
  .strict();

export const widgetCreateSchema = z
  .object({
    dashboardId: z.string(),
    widget: widgetBodySchema,
  })
  .strict();

export const widgetUpdateSchema = z
  .object({
    widgetId: z.string(),
    widget: widgetBodySchema,
  })
  .strict();

export const widgetDeleteSchema = z
  .object({
    widgetId: z.string(),
    skipTrash: z.boolean().optional(),
  })
  .strict();

export const duplicateWidgetSchema = z
  .object({
    widgetId: z.string(),
  })
  .strict();
