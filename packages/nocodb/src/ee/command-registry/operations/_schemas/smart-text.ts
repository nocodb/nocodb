import { z } from 'zod';

const proseMirrorDocSchema = z.record(z.any());

export const smartTextUpdateContentSchema = z
  .object({
    tableId: z.string(),
    rowId: z.string(),
    columnId: z.string(),
    pmContent: proseMirrorDocSchema,
  })
  .strict();
