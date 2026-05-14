import { z } from 'zod';

const metaJson = z.record(z.unknown()).nullable();

export const extensionBodySchema = z
  .object({
    title: z.string().optional(),
    extension_id: z.string().optional(),
    kv_store: metaJson.optional(),
    meta: metaJson.optional(),
    order: z.number().optional(),

    // Replay-time injection (idField: 'extension'):
    id: z.string().optional(),
  })
  .strict();

export const extensionCreateSchema = z
  .object({
    extension: extensionBodySchema,
  })
  .strict();

export const extensionUpdateSchema = z
  .object({
    extensionId: z.string(),
    extension: extensionBodySchema,
  })
  .strict();

export const extensionDeleteSchema = z
  .object({
    extensionId: z.string(),
    skipTrash: z.boolean().optional(),
  })
  .strict();
