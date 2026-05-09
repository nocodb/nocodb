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
    forwardPk: z.string().optional(),
  })
  .strict();

const displacedJunctionSchema = z
  .object({
    kind: z.literal('junction'),
    mmModelId: z.string(),
    colId: z.string(),
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

const recordModelContextSchema = z
  .object({
    modelId: z.string(),
    /** All pk titles in canonical order. */
    primaryKeyTitles: z.array(z.string()),
  })
  .strict();

/** `meta.extra` capture-schema shape for `recordInsert` (and any other
 *  contract that opts into displacement capture).
 *
 *  All fields optional — old log entries written before a slot was
 *  added stay readable. `softDeleteTrashId` is written via `metaUpdate`
 *  after the first `recordInsertUndo` (the undo soft-deletes and
 *  captures the new trashId) so subsequent redos can restore from
 *  trash instead of fresh-inserting. */
export const recordInsertCaptureSchema = z
  .object({
    displacedRecords: z.array(displacedRecordSchema).optional(),
    recordModelContext: recordModelContextSchema.optional(),
    softDeleteTrashId: z.string().nullable().optional(),
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

/** Forward params for `recordBulkInsert` — same loose v1/v2 shape as
 *  `recordInsert`, but `body` is always an array.
 */
export const recordBulkInsertSchema = z
  .object({
    modelId: z.string().optional(),
    baseId: z.string().optional(),
    viewId: z.string().optional(),
    baseName: z.string().optional(),
    tableName: z.string().optional(),
    viewName: z.string().optional(),
    body: z.array(z.unknown()),
    cookie: z.unknown().optional(),
    undo: z.boolean().optional(),
    apiVersion: z.string().optional(),
    internalFlags: z.unknown().optional(),
    query: z.unknown().optional(),
  })
  .passthrough();

/** Capture-schema for `recordBulkInsert`. Same shape as the single-row
 *  variant — context + displaced rows captured during nested LTAR
 *  preparation. */
export const recordBulkInsertCaptureSchema = recordInsertCaptureSchema;

/** Body shape passed to `recordBulkInsertUndo` — bulk-deletes the
 *  inserted rows by pk and restores any displaced rows. */
export const recordBulkInsertUndoSchema = z
  .object({
    modelId: z.string(),
    pks: z.array(z.union([z.string(), z.number()])),
    displacedRecords: z.array(displacedRecordSchema),
  })
  .strict();

/** Forward params for `recordDelete` — accepts both v1
 *  (`baseName`/`tableName`/`rowId`) and v2 (`modelId`/`body`) shapes. */
export const recordDeleteSchema = z
  .object({
    modelId: z.string().optional(),
    baseId: z.string().optional(),
    viewId: z.string().optional(),
    baseName: z.string().optional(),
    tableName: z.string().optional(),
    viewName: z.string().optional(),
    rowId: z.union([z.string(), z.number()]).optional(),
    body: z.unknown().optional(),
    cookie: z.unknown().optional(),
    query: z.unknown().optional(),
  })
  .passthrough();

/** `meta.extra` for recordDelete — context + prev-row snapshot +
 *  trashId emitted by `afterSoftDeleteCompleted`. */
export const recordDeleteCaptureSchema = z
  .object({
    recordModelContext: recordModelContextSchema.optional(),
    recordPrev: z.array(z.record(z.unknown())).optional(),
    displacedRecords: z.array(displacedRecordSchema).optional(),
    softDeleteTrashId: z.string().nullable().optional(),
  })
  .strict();

/** Body for `recordDeleteUndo` — restore the row.
 *   trashId path: just call baseTrashSvc.restore.
 *   no-trash path: re-insert `prev` and restore `displacedRecords`. */
export const recordDeleteUndoSchema = z
  .object({
    modelId: z.string(),
    pk: z.union([z.string(), z.number()]),
    prev: z.record(z.unknown()),
    displacedRecords: z.array(displacedRecordSchema).optional(),
  })
  .strict();

/** Forward params for `recordBulkDelete` — same loose shape, body is array. */
export const recordBulkDeleteSchema = z
  .object({
    modelId: z.string().optional(),
    baseId: z.string().optional(),
    viewId: z.string().optional(),
    baseName: z.string().optional(),
    tableName: z.string().optional(),
    viewName: z.string().optional(),
    body: z.array(z.unknown()),
    cookie: z.unknown().optional(),
    query: z.unknown().optional(),
  })
  .passthrough();

export const recordBulkDeleteUndoSchema = z
  .object({
    modelId: z.string(),
    rows: z.array(
      z
        .object({
          pk: z.union([z.string(), z.number()]),
          prev: z.record(z.unknown()),
        })
        .strict(),
    ),
    displacedRecords: z.array(displacedRecordSchema).optional(),
  })
  .strict();
