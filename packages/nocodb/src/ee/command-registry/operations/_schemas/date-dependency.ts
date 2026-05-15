import { z } from 'zod';

const linkrowRoleSchema = z.string();
const connectionTypeSchema = z.string();
const bufferTypeSchema = z.string();

export const dateDependencyBodySchema = z
  .object({
    fk_start_date_field_id: z.string().nullable().optional(),
    fk_end_date_field_id: z.string().nullable().optional(),
    fk_duration_field_id: z.string().nullable().optional(),
    fk_dependency_linkrow_field_id: z.string().nullable().optional(),
    dependency_linkrow_role: linkrowRoleSchema.nullable().optional(),
    dependency_connection_type: connectionTypeSchema.nullable().optional(),
    dependency_buffer_type: bufferTypeSchema.nullable().optional(),
    dependency_buffer_days: z.number().int().nullable().optional(),
    include_weekends: z.boolean().nullable().optional(),
    is_active: z.boolean().nullable().optional(),
  })
  .strict();

export const dateDependencyUpdateSchema = z
  .object({
    modelId: z.string(),
    body: dateDependencyBodySchema,
    /** When present, the rule is scoped to a specific Gantt view
     *  (`nc_date_dependency.fk_gantt_view_id`); otherwise it's the
     *  table-level default. Optional — old persisted rows (pre-Gantt)
     *  parse cleanly without it. */
    ganttViewId: z.string().optional(),
  })
  .strict();

export const dateDependencyDeleteSchema = z
  .object({
    modelId: z.string(),
    ganttViewId: z.string().optional(),
  })
  .strict();
