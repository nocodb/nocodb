import { z } from 'zod';

export const sortBodySchema = z
  .object({
    fk_column_id: z.string().optional(),
    direction: z.enum(['asc', 'desc']).optional(),
    fk_level_id: z.string().nullable().optional(),
    /** Injected by the dispatcher under replay (`idField: 'sort'`). */
    id: z.string().optional(),
    /** Sandbox replay preserves order; service-level inserts compute it. */
    order: z.number().optional(),
  })
  .strict();

export const sortCreateSchema = z
  .object({
    viewId: z.string(),
    sort: sortBodySchema,
  })
  .strict();

export const sortUpdateSchema = z
  .object({
    sortId: z.string(),
    sort: sortBodySchema,
  })
  .strict();

export const sortDeleteSchema = z
  .object({
    sortId: z.string(),
  })
  .strict();
