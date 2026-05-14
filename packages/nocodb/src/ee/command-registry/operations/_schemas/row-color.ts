import { z } from 'zod';
import { COLORING_TYPE, ROW_COLORING_MODE } from 'nocodb-sdk';
import { filterBodySchema } from './filter';

const COLORING_TYPE_VALUES = [COLORING_TYPE.ROW, COLORING_TYPE.CELL] as const;

const conditionBodyBaseSchema = z
  .object({
    color: z.string(),
    is_set_as_background: z.boolean(),
    nc_order: z.number().int(),
    type: z.enum(COLORING_TYPE_VALUES).optional(),
    fk_target_column_id: z.string().nullable().optional(),
  })
  .strict();

export const rowColorConditionAddSchema = z
  .object({
    fk_view_id: z.string(),
    condition: conditionBodyBaseSchema
      .extend({ id: z.string().optional() })
      .strict(),
    /**
     * Single-root filter tree forwarded by the FE create flow. Service
     * recurses through `children`.
     */
    filter: filterBodySchema.optional(),
    /**
     * Multi-root tree carried by the inverse of `rowColorConditionDelete`.
     * Each entry is a recursive `filterBodySchema` (own filter row plus
     * `children` descendants).
     */
    filters: z.array(filterBodySchema).optional(),
  })
  .strict();

export const rowColorConditionUpdateSchema = z
  .object({
    /** Optional FK so the inverse can echo it for changelog parent context. */
    fk_view_id: z.string().optional(),
    fk_row_coloring_conditions_id: z.string(),
    condition: conditionBodyBaseSchema,
  })
  .strict();

export const rowColorConditionDeleteSchema = z
  .object({
    fk_view_id: z.string().optional(),
    fk_row_coloring_conditions_id: z.string(),
  })
  .strict();

/** `view.meta` is a JSON-text column — accepted as an opaque object. */
const viewMetaSchema = z.record(z.unknown());

/** Snapshot row used by the inverse of `rowColorSelectSet` / `rowColoringRemove`. */
export const rowColoringConditionSnapshotSchema = z
  .object({
    id: z.string(),
    color: z.string(),
    nc_order: z.number().int(),
    is_set_as_background: z.boolean(),
    type: z.enum(COLORING_TYPE_VALUES).optional(),
    fk_target_column_id: z.string().nullable().optional(),
    /** Filter tree — each root may carry `children` descendants. */
    nestedFilters: z.array(filterBodySchema),
  })
  .strict();

const ROW_COLORING_MODES = [
  ROW_COLORING_MODE.FILTER,
  ROW_COLORING_MODE.SELECT,
] as const;

export const rowColoringSnapshotSchema = z
  .object({
    row_coloring_mode: z.union([z.enum(ROW_COLORING_MODES), z.null()]),
    /** Captured under SELECT mode (the view's `meta` JSON object). */
    meta: viewMetaSchema.optional(),
    /** Captured under FILTER mode (per-condition tree). */
    conditions: z.array(rowColoringConditionSnapshotSchema).optional(),
  })
  .strict();

export const rowColorSelectSetSchema = z
  .object({
    fk_view_id: z.string(),
    fk_column_id: z.string(),
    is_set_as_background: z.boolean(),
  })
  .strict();

export const rowColoringRemoveSchema = z
  .object({
    fk_view_id: z.string(),
  })
  .strict();

export const rowColoringRestoreSchema = z
  .object({
    fk_view_id: z.string(),
    snapshot: rowColoringSnapshotSchema,
  })
  .strict();

/**
 * Persisted shape of `meta.extra` for `rowColorConditionAdd`.
 */
export const rowColorAddCaptureSchema = z
  .object({
    rowColorFilterIds: z.array(z.string()).optional(),
  })
  .strict()
  .optional();
