import { z } from 'zod';

/**
 * One side-effect row mutated by an insert/update with nested LTAR
 * data. Captured before the mutating SQL runs in
 * `prepareNestedLinkQb`; replayed on undo to restore the prior state.
 */
const displacedColumnSchema = z
  .object({
    kind: z.literal('column'),
    modelId: z.string(),
    pk: z.string(),
    column: z.string(),
    prev: z.unknown(),
    forward: z.enum(['null', 'newRowPk']).optional(),
  })
  .strict();

const displacedJunctionSchema = z
  .object({
    kind: z.literal('junction'),
    mmModelId: z.string(),
    colId: z.string().optional(),
    parentMMCol: z.string(),
    childMMCol: z.string(),
    parentValue: z.union([z.string(), z.number()]),
    childValue: z.union([z.string(), z.number()]),
  })
  .strict();

export const displacedRecordSchema = z.discriminatedUnion('kind', [
  displacedColumnSchema,
  displacedJunctionSchema,
]);

const recordInsertContextSchema = z
  .object({
    modelId: z.string(),
    primaryKeyTitle: z.string(),
    primaryKeyColumnName: z.string(),
  })
  .strict();

/** `meta.extra` capture-schema shape for `recordInsert` (and any other
 *  contract that opts into displacement capture).
 *
 *  Both fields are optional at the schema level so we don't break old
 *  log entries written before a slot was added.
 */
export const recordInsertCaptureSchema = z
  .object({
    displacedRecords: z.array(displacedRecordSchema).optional(),
    recordInsertContext: recordInsertContextSchema.optional(),
  })
  .strict();

/** Body shape passed to `recordInsertUndo` — the inverse-only
 *  primitive that hard-deletes the row and re-applies any displaced
 *  side-effect rows.
 */
export const recordInsertUndoSchema = z
  .object({
    modelId: z.string(),
    pk: z.string(),
    displacedRecords: z.array(displacedRecordSchema),
  })
  .strict();
