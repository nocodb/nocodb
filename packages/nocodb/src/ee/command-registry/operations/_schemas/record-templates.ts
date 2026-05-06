import { z } from 'zod';

/**
 * `RecordTemplateDataType` — `{ fields, ltarState? }`. The model stores
 * the column as text (JSON-encoded) and `RecordTemplate.castType` parses
 * it back to the object form on read; on write the service stringifies
 * before insert. Both forms cross the dispatcher boundary, so the
 * schema accepts either.
 */
const recordTemplateDataSchema = z.union([
  z
    .object({
      fields: z.record(z.unknown()),
      ltarState: z.record(z.unknown()).optional(),
    })
    .strict(),
  z.string(),
]);

/** Body shape for create (`RecordTemplateReqType` + replay-injected id). */
const recordTemplateCreateBodySchema = z
  .object({
    /** Replay-injected — preserved across sandbox merge. */
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    template_data: recordTemplateDataSchema.optional(),
    /** Set on inverse-of-delete restoration. */
    enabled: z.boolean().optional(),
  })
  .strict();

/** Body shape for update (`RecordTemplateUpdateReqType`). */
const recordTemplateUpdateBodySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    template_data: recordTemplateDataSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

export const recordTemplateCreateSchema = z
  .object({
    baseId: z.string(),
    tableId: z.string(),
    body: recordTemplateCreateBodySchema,
    userId: z.string(),
  })
  .strict();

export const recordTemplateUpdateSchema = z
  .object({
    templateId: z.string(),
    template: recordTemplateUpdateBodySchema.optional(),
    userId: z.string(),
  })
  .strict();

export const recordTemplateDeleteSchema = z
  .object({
    templateId: z.string(),
    userId: z.string(),
  })
  .strict();
