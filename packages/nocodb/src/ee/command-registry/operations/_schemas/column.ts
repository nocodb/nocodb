import { z } from 'zod';
import { NcApiVersion, UITypes } from 'nocodb-sdk';

const boolType = z.union([z.boolean(), z.literal(0), z.literal(1), z.null()]);
const stringOrNullOrBool = z.union([
  z.string(),
  z.boolean(),
  z.number(),
  z.null(),
]);
const stringOrNumber = z.union([z.string(), z.number(), z.null()]);

const UIDT_VALUES = Object.values(UITypes) as [string, ...string[]];

export const columnBodySchema = z
  .object({
    // API surface (NormalColumnRequestType + ColumnReqType extras)
    title: z.string().optional(),
    column_name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    uidt: z.enum(UIDT_VALUES).optional(),

    // Type metadata
    dt: z.string().nullable().optional(),
    dtx: z.string().nullable().optional(),
    dtxp: z.union([z.string(), z.number(), z.null()]).optional(),
    dtxs: stringOrNumber.optional(),
    np: stringOrNumber.optional(),
    ns: stringOrNumber.optional(),
    clen: stringOrNumber.optional(),
    cop: z.string().nullable().optional(),
    ct: z.string().nullable().optional(),

    // Constraints (BoolType per SDK)
    pk: boolType.optional(),
    pv: boolType.optional(),
    rqd: boolType.optional(),
    un: boolType.optional(),
    ai: boolType.optional(),
    au: boolType.optional(),
    unique: boolType.optional(),
    readonly: boolType.optional(),
    virtual: boolType.optional(),
    system: boolType.optional(),

    cdf: stringOrNullOrBool.optional(),
    cc: z.string().nullable().optional(),
    csn: z.string().nullable().optional(),
    validate: z.union([z.string(), z.record(z.unknown()), z.null()]).optional(),

    meta: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
    order: z.number().optional(),
    custom_index_name: z.string().nullable().optional(),

    // ColumnReqType extras
    column_order: z
      .object({
        order: z.number().optional(),
        view_id: z.string().optional(),
      })
      .strict()
      .optional(),
    view_id: z.string().optional(),

    // Replay-time injection (idField: 'column'). Sandbox replay's
    id: z.string().optional(),

    filters: z.array(z.record(z.unknown())).optional(),

    colOptions: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const columnAddSchema = z
  .object({
    tableId: z.string(),
    column: columnBodySchema,
    apiVersion: z.nativeEnum(NcApiVersion).optional(),
  })
  .strict();

export const columnUpdateSchema = z
  .object({
    columnId: z.string(),
    column: columnBodySchema,
    tableId: z.string().optional(),
    apiVersion: z.nativeEnum(NcApiVersion).optional(),
  })
  .strict();

export const columnDeleteSchema = z
  .object({
    columnId: z.string(),
    skipTrash: z.boolean().optional(),
    forceDeleteSystem: z.boolean().optional(),
    skipLinkPlaceholder: z.boolean().optional(),
  })
  .strict();

export const columnSetAsPrimarySchema = z
  .object({
    columnId: z.string(),
  })
  .strict();

const ltarHmBtCallSchema = z
  .object({
    childRelColId: z.string().optional(),
    savedColumnId: z.string().optional(),
  })
  .strict()
  .optional();

const ltarSideEffectSchema = z
  .object({
    fkColumnId: z.string().optional(),
    assocModelId: z.string().optional(),
    assocDefaultViewId: z.string().optional(),
    reverseColumnId: z.string().optional(),
    assocChildColId: z.string().optional(),
    assocParentColId: z.string().optional(),
    hmBtCallRef: ltarHmBtCallSchema,
    hmBtCallTable: ltarHmBtCallSchema,
  })
  .strict()
  .optional();

export const columnAddExtraSchema = z
  .object({
    ltar: ltarSideEffectSchema,
    filters: z.array(z.record(z.unknown())).optional(),
  })
  .strict()
  .optional();

const columnBackupRefSchema = z
  .object({
    backupColumnName: z.string(),
    sourceColumnId: z.string(),
    fkModelId: z.string(),
  })
  .strict();

export const columnUpdateExtraSchema = z
  .object({
    backup: columnBackupRefSchema.optional(),
    // Set only when a columnUpdate is a SingleLineText→link conversion: the
    // created link column's id + its hidden side-effect ids, so undo can
    // remove them and redo can recreate them with the same ids.
    ltar: ltarSideEffectSchema,
    convertedLink: z
      .object({
        linkColumnId: z.string(),
        /** Snapshot of the replaced text column — rebuilt on undo. */
        textColumn: z.record(z.unknown()),
      })
      .strict()
      .optional(),
    // Set only when a columnUpdate is a link→SingleLineText conversion: the
    // created text column's id, so redo / sandbox replay recreates it with the
    // same id (the link is rebuilt from this column's joined text on undo).
    convertedText: z
      .object({
        textColumnId: z.string(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

/** Relationship config of the link column captured before a link→text
 *  conversion, used to recreate the link on undo. */
const linkConfigSchema = z
  .object({
    id: z.string(),
    fk_model_id: z.string(),
    title: z.string().optional(),
    uidt: z.string().optional(),
    type: z.string().optional(),
    parentId: z.string().optional(),
    childId: z.string().optional(),
    ref_base_id: z.string().nullable().optional(),
    fk_target_view_id: z.string().nullable().optional(),
    fk_display_value_column_id: z.string().nullable().optional(),
    meta: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
    // Junction-less `bt` only: the paired `hm` column (id + title) so undo can
    // recreate the whole hm/bt pair with original ids.
    pairedColumnId: z.string().optional(),
    pairedColumnTitle: z.string().optional(),
  })
  .strict();

export const columnRevertTextToLinkSchema = z
  .object({
    /** Text column created by the forward conversion — dropped + re-read for
     *  the link backfill. */
    textColumnId: z.string(),
    /** Original link relationship config (incl. id) used to recreate it. */
    link: linkConfigSchema,
    tableId: z.string().optional(),
  })
  .strict();

export const columnRevertLinkToTextSchema = z
  .object({
    linkColumnId: z.string(),
    /** Original text column snapshot (incl. id) used to recreate it. */
    textColumn: z.record(z.unknown()),
    tableId: z.string().optional(),
  })
  .strict();

export const columnRevertLinkToTextExtraSchema = z
  .object({
    /** Re-conversion (redo) needs the link side-effect ids to reuse. */
    ltar: ltarSideEffectSchema,
    convertedLink: z
      .object({
        linkColumnId: z.string(),
        textColumn: z.record(z.unknown()),
      })
      .strict()
      .optional(),
    backup: columnBackupRefSchema.optional(),
  })
  .strict()
  .optional();

const bulkOpKindEnum = z.enum(['add', 'update', 'delete']);

const bulkOpSchema = z
  .object({
    op: bulkOpKindEnum,
    column: columnBodySchema,
  })
  .strict();

const visibilityOpSchema = z
  .object({
    viewId: z.string(),
    /** View-column row id (e.g. nc_grid_view_columns.id), NOT the
     *  underlying nc_columns.id — matches the existing single-call
     *  shape that `useViewColumns.saveOrUpdate` uses today. */
    columnId: z.string(),
    column: z
      .object({
        show: z
          .union([z.boolean(), z.literal(0), z.literal(1), z.null()])
          .optional(),
        order: z.number().nullable().optional(),
        underline: z
          .union([z.boolean(), z.literal(0), z.literal(1), z.null()])
          .optional(),
        bold: z
          .union([z.boolean(), z.literal(0), z.literal(1), z.null()])
          .optional(),
        italic: z
          .union([z.boolean(), z.literal(0), z.literal(1), z.null()])
          .optional(),
      })
      .strict(),
  })
  .strict();

export const columnsBulkSchema = z
  .object({
    tableId: z.string(),
    /** Optimistic-concurrency hash from MODELS.columnsHash; service rejects
     *  if it doesn't match the current value. */
    hash: z.string(),
    ops: z.array(bulkOpSchema),
    visibility: z.array(visibilityOpSchema).optional(),
  })
  .strict();
