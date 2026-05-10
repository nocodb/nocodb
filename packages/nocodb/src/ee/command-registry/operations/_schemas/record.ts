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

/** V3-update LTAR diff entry — captured at `bulkUpdate` entry, replayed
 *  on undo via `addLinks`/`removeLinks` (inverted). */
export const linkChangeSchema = z
  .object({
    op: z.enum(['add', 'remove']),
    colId: z.string(),
    rowId: z.string(),
    childIds: z.array(z.union([z.string(), z.number()])),
  })
  .strict();

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

/** Forward params for `recordUpdate` — same loose v1/v2 shape as
 *  insert/delete; `body` is a single object (or single-element array;
 *  the dispatch resolver routes len > 1 to `recordBulkUpdate`). */
export const recordUpdateSchema = z
  .object({
    modelId: z.string().optional(),
    baseId: z.string().optional(),
    viewId: z.string().optional(),
    baseName: z.string().optional(),
    tableName: z.string().optional(),
    viewName: z.string().optional(),
    body: z.unknown(),
    cookie: z.unknown().optional(),
    undo: z.boolean().optional(),
    apiVersion: z.string().optional(),
    internalFlags: z.unknown().optional(),
    query: z.unknown().optional(),
  })
  .passthrough();

/** Forward params for `recordBulkUpdate` — `body` is always an array. */
export const recordBulkUpdateSchema = z
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

/** `meta.extra` for record(Bulk)Update — model context + per-row prev
 *  snapshot (changed-fields only) + LTAR-displaced rows + V3 link diff.
 *  No trash slot: updates never go through soft-delete. */
export const recordUpdateCaptureSchema = z
  .object({
    recordModelContext: recordModelContextSchema.optional(),
    /** Pre-update snapshots, narrowed to ONLY the keys touched by the
     *  update body — full-row snapshots would bloat the log entry on
     *  wide tables when only one column changed. Each entry MUST carry
     *  all pk columns so the row can still be located on undo even
     *  when no non-pk field was touched. */
    recordPrev: z.array(z.record(z.unknown())).optional(),
    displacedRecords: z.array(displacedRecordSchema).optional(),
    /** V3 update LTAR diff — junction inserts/deletes the V3 path
     *  performs via `updateLTARCols`. Empty / absent for V1 / V2
     *  scalar-only updates. */
    linkChanges: z.array(linkChangeSchema).optional(),
  })
  .strict();

export const recordBulkUpdateCaptureSchema = recordUpdateCaptureSchema;

/** Body for `recordUpdateUndo` — restore one row by writing `prev`
 *  back. `body` is the original update payload; the redo path reuses
 *  it (after stripServerControlledFields) so a second redo replays
 *  the original mutation. `linkChanges` carries the V3 LTAR diff
 *  produced by `updateLTARCols` — undo inverts each entry. */
export const recordUpdateUndoSchema = z
  .object({
    modelId: z.string(),
    pk: z.union([z.string(), z.number()]),
    /** Changed-fields-only snapshot from before the forward update.
     *  Always includes pk columns. */
    prev: z.record(z.unknown()),
    /** Original update body (post-NON_SERIALIZABLE_KEYS strip). */
    body: z.record(z.unknown()),
    displacedRecords: z.array(displacedRecordSchema).optional(),
    linkChanges: z.array(linkChangeSchema).optional(),
    /** Forward-context propagated so the undo path matches V3 typecasting
     *  (mapAliasToColumn DateTime branch is V1-only). */
    apiVersion: z.string().optional(),
    viewId: z.string().optional(),
    baseId: z.string().optional(),
  })
  .strict();

/** Body for `recordBulkUpdateUndo` — per-row `(pk, prev, body)` so
 *  bulk-update can be reversed row-by-row even when individual rows
 *  touched different columns. `linkChanges` is bulk-flat (per-(col,
 *  row, target) triples already carry their `rowId`). */
export const recordBulkUpdateUndoSchema = z
  .object({
    modelId: z.string(),
    rows: z.array(
      z
        .object({
          pk: z.union([z.string(), z.number()]),
          prev: z.record(z.unknown()),
          body: z.record(z.unknown()),
        })
        .strict(),
    ),
    displacedRecords: z.array(displacedRecordSchema).optional(),
    linkChanges: z.array(linkChangeSchema).optional(),
    /** Forward-context propagated — see recordUpdateUndoSchema. */
    apiVersion: z.string().optional(),
    viewId: z.string().optional(),
    baseId: z.string().optional(),
  })
  .strict();

/** Forward params for `recordLinkAdd` / `recordLinkRemove` — explicit
 *  link mutations. The two contracts are each other's inverse: undoing
 *  an add is a remove, undoing a remove is an add — same triple in both
 *  directions.
 *
 *  Accepts BOTH dispatch shapes:
 *   - v2 (`nestedLink`/`nestedUnlink`): `{modelId, columnId, rowId,
 *     refRowIds}` → routes through `addLinks`/`removeLinks`.
 *   - v1 (`relationDataAdd`/`relationDataRemove`): `{baseName,
 *     tableName, columnName, rowId, refRowId}` → routes through
 *     `addChild`/`removeChild`. v1 endpoints carry one ref at a time.
 *
 *  Handler dispatches on which params shape is present so the inverse
 *  goes through the same service the user invoked (audit/realtime
 *  semantics stay consistent with the forward op). */
export const recordLinkSchema = z
  .object({
    // v2 path
    modelId: z.string().optional(),
    baseId: z.string().optional(),
    viewId: z.string().optional(),
    columnId: z.string().optional(),
    refRowIds: z.unknown().optional(),
    // v1 path
    baseName: z.string().optional(),
    tableName: z.string().optional(),
    viewName: z.string().optional(),
    columnName: z.string().optional(),
    refRowId: z.union([z.string(), z.number()]).optional(),
    // Shared
    rowId: z.union([z.string(), z.number()]),
    cookie: z.unknown().optional(),
    query: z.unknown().optional(),
    user: z.unknown().optional(),
  })
  .passthrough();

/** Forward params for `recordMove` — drag-to-reorder. `beforeRowId`
 *  identifies the row the moved row should land immediately before
 *  (null/undefined = move to end). `recordMove` is self-inverse: undo
 *  re-runs `moveRecord` with the captured pre-move neighbor. */
export const recordMoveSchema = z
  .object({
    modelId: z.string().optional(),
    baseId: z.string().optional(),
    viewId: z.string().optional(),
    rowId: z.union([z.string(), z.number()]),
    beforeRowId: z.union([z.string(), z.number()]).nullable().optional(),
    cookie: z.unknown().optional(),
    user: z.unknown().optional(),
  })
  .passthrough();

/** `meta.extra` for recordMove — captures the pk of the row that was
 *  immediately AFTER the moved row in the pre-move ordering. That pk
 *  becomes `beforeRowId` for the inverse `moveRecord` call (which
 *  re-positions the row back to its original slot). `null` when the
 *  row was at the end (undo moves it back to the end). */
export const recordMoveCaptureSchema = z
  .object({
    recordModelContext: recordModelContextSchema.optional(),
    movePrev: z
      .object({
        pk: z.union([z.string(), z.number()]),
        beforeRowId: z.union([z.string(), z.number()]).nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();

/** Single link-swap entry: applies a precomputed diff against one
 *  (rowId, columnId) — `unlink` pks are removed, `link` pks added.
 *  Used as both forward-params and inverse-params shape (link↔unlink
 *  swap is the mechanical inverse). */
const linkSwapEntrySchema = z
  .object({
    columnId: z.string(),
    rowId: z.union([z.string(), z.number()]),
    link: z.array(z.union([z.string(), z.number()])),
    unlink: z.array(z.union([z.string(), z.number()])),
  })
  .strict();

/** Forward params for `recordLinkSwap` — covers a single (rowId,
 *  columnId) link diff. Self-inverse via link↔unlink swap. */
export const recordLinkSwapSchema = z
  .object({
    modelId: z.string(),
    baseId: z.string().optional(),
    viewId: z.string().optional(),
    columnId: z.string(),
    rowId: z.union([z.string(), z.number()]),
    link: z.array(z.union([z.string(), z.number()])),
    unlink: z.array(z.union([z.string(), z.number()])),
    cookie: z.unknown().optional(),
    user: z.unknown().optional(),
  })
  .passthrough();

/** Forward params for `recordLinkSwapBulk` — multiple link-diffs in one
 *  user-facing op (powers `nestedListBulkCopyPasteOrDeleteAll`).
 *  Self-inverse via per-entry link↔unlink swap. */
export const recordLinkSwapBulkSchema = z
  .object({
    modelId: z.string(),
    baseId: z.string().optional(),
    viewId: z.string().optional(),
    entries: z.array(linkSwapEntrySchema),
    cookie: z.unknown().optional(),
    user: z.unknown().optional(),
  })
  .passthrough();

/** Forward params for `recordLinkByDisplay` — bulk link-by-display-value
 *  op (powers `nestedBulkLinkByDisplayValue`). The forward path resolves
 *  display strings to pks, then this op records the RESOLVED pks (NOT
 *  the original strings — strings can match different rows on replay if
 *  data drifts). Self-inverse via per-entry link↔unlink swap. */
export const recordLinkByDisplaySchema = z
  .object({
    modelId: z.string(),
    baseId: z.string().optional(),
    viewId: z.string().optional(),
    entries: z.array(linkSwapEntrySchema),
    cookie: z.unknown().optional(),
    user: z.unknown().optional(),
  })
  .passthrough();

/** Forward params for `recordBulkUpsert`. Per-row update/insert outcome
 *  is recorded in `upsertChanges` for the inverse. */
export const recordBulkUpsertSchema = z
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
  })
  .passthrough();

/** Updates carry the pre-update snapshot for undo's restore step;
 *  inserts only need the pk for undo's trash step. */
const upsertChangeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('update'),
      pk: z.union([z.string(), z.number()]),
      prev: z.record(z.unknown()),
    })
    .strict(),
  z
    .object({
      kind: z.literal('insert'),
      pk: z.union([z.string(), z.number()]),
    })
    .strict(),
]);

/** `meta.extra` for `recordBulkUpsert`. `softDeleteTrashId` is rotated
 *  in by the inverse handler — used by redo's trash-restore path. */
export const recordBulkUpsertCaptureSchema = z
  .object({
    recordModelContext: recordModelContextSchema.optional(),
    upsertChanges: z.array(upsertChangeSchema).optional(),
    softDeleteTrashId: z.string().nullable().optional(),
  })
  .strict();

export const recordBulkUpsertUndoSchema = z
  .object({
    modelId: z.string(),
    updates: z.array(
      z
        .object({
          pk: z.union([z.string(), z.number()]),
          prev: z.record(z.unknown()),
        })
        .strict(),
    ),
    insertPks: z.array(z.union([z.string(), z.number()])),
    apiVersion: z.string().optional(),
    viewId: z.string().optional(),
    baseId: z.string().optional(),
  })
  .strict();
