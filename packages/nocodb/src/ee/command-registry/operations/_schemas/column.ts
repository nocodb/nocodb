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

export const columnAddExtraSchema = z
  .object({
    ltar: z
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
      .optional(),
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
