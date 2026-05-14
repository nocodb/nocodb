import { z } from 'zod';

const groupOperatorSchema = z.enum(['AND', 'OR']);

/** `FilterV3Type` — leaf filter on one field. */
const filterV3LeafSchema = z
  .object({
    id: z.string().optional(),
    parent_id: z.string().optional(),
    field_id: z.string(),
    operator: z.string(),
    sub_operator: z.string().nullable().optional(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  })
  .strict();

type FilterV3GroupShape = {
  id?: string;
  parent_id?: string;
  group_operator: 'AND' | 'OR';
  filters: Array<z.infer<typeof filterV3LeafSchema> | FilterV3GroupShape>;
};

const filterV3GroupSchema = z.lazy(() =>
  z
    .object({
      id: z.string().optional(),
      parent_id: z.string().optional(),
      group_operator: groupOperatorSchema,
      filters: z.array(z.union([filterV3LeafSchema, filterV3GroupSchema])),
    })
    .strict(),
) as z.ZodType<FilterV3GroupShape>;

/** `FilterCreateV3Type = FilterV3Type | FilterGroupLevel1V3Type`. */
const filterV3CreateBodySchema = z.union([
  filterV3LeafSchema,
  filterV3GroupSchema,
]);

export const filterCreateV3Schema = z
  .object({
    filter: filterV3CreateBodySchema,
    viewId: z.string(),
  })
  .strict();

export const filterReplaceV3Schema = z
  .object({
    filter: filterV3CreateBodySchema,
    viewId: z.string(),
  })
  .strict();

export const filterDeleteAllV3Schema = z
  .object({
    viewId: z.string(),
  })
  .strict();
