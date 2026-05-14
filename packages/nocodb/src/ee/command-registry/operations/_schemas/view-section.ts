import { z } from 'zod';

export const viewSectionBodySchema = z
  .object({
    title: z.string().optional(),
    order: z.number().optional(),
    meta: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
    fk_model_id: z.string().nullable().optional(),
    /** Replay-time injection (idField: 'section'). */
    id: z.string().optional(),
  })
  .strict();

export const viewSectionCreateSchema = z
  .object({
    tableId: z.string(),
    section: viewSectionBodySchema,
  })
  .strict();

export const viewSectionUpdateSchema = z
  .object({
    viewSectionId: z.string(),
    section: viewSectionBodySchema.optional(),
  })
  .strict();

export const viewSectionDeleteSchema = z
  .object({
    viewSectionId: z.string(),
  })
  .strict();
