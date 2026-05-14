import { z } from 'zod';

const detailsSchema = z.record(z.unknown());

const syncBodySchema = z
  .object({
    /** Replay-injected — preserved across sandbox merge. */
    id: z.string().optional(),
    title: z.string().optional(),
    type: z.string().optional(),
    details: detailsSchema.optional(),
    deleted: z.boolean().optional(),
    order: z.number().optional(),
    source_id: z.string().optional(),
  })
  .strict();

export const syncCreateSchema = z
  .object({
    baseId: z.string(),
    sourceId: z.string().optional(),
    userId: z.string(),
    syncPayload: syncBodySchema,
  })
  .strict();

export const syncUpdateSchema = z
  .object({
    syncId: z.string(),
    syncPayload: syncBodySchema,
  })
  .strict();

export const syncDeleteSchema = z
  .object({
    syncId: z.string(),
  })
  .strict();
