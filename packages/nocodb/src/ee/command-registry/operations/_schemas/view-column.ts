import { z } from 'zod';

const boolType = z.union([z.boolean(), z.literal(0), z.literal(1)]);
const nullableBoolType = z.union([
  z.boolean(),
  z.literal(0),
  z.literal(1),
  z.null(),
]);

/**
 * Body for `viewColumnUpdate`. Spans every per-view-type child table
 * (Grid/Form/Gallery/Kanban/Map/Calendar/Timeline) — only the fields
 * shared across all of them. Per-view extras (width, group_by,
 * label, etc.) flow through dedicated contracts (`gridColumnUpdate`,
 * `formColumnUpdate`).
 */
const viewColumnBodySchema = z
  .object({
    show: nullableBoolType.optional(),
    order: z.number().nullable().optional(),
    /** Calendar/Timeline cell-formatting. Backed by boolean columns. */
    underline: nullableBoolType.optional(),
    bold: nullableBoolType.optional(),
    italic: nullableBoolType.optional(),
  })
  .strict();

export const viewColumnUpdateSchema = z
  .object({
    viewId: z.string(),
    columnId: z.string(),
    column: viewColumnBodySchema,
  })
  .strict();

/** `nc_grid_view_columns` body. */
const gridColumnBodySchema = z
  .object({
    show: nullableBoolType.optional(),
    order: z.number().nullable().optional(),
    /**
     * String column on the table — values like `'200px'` come from FE.
     * Service / model don't enforce a numeric type so accept any string.
     */
    width: z.string().nullable().optional(),
    group_by: nullableBoolType.optional(),
    group_by_order: z.number().nullable().optional(),
    group_by_sort: z.string().nullable().optional(),
    /**
     * Aggregation values are domain-validated against the per-column
     * UIType in the runtime aggregation helper — schema accepts any
     * string + null so legacy / future variants round-trip cleanly.
     */
    aggregation: z.string().nullable().optional(),
  })
  .strict();

export const gridColumnUpdateSchema = z
  .object({
    gridViewColumnId: z.string(),
    grid: gridColumnBodySchema,
  })
  .strict();

/** `nc_form_view_columns` body. */
const formColumnBodySchema = z
  .object({
    label: z.string().nullable().optional(),
    help: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    required: nullableBoolType.optional(),
    enable_scanner: nullableBoolType.optional(),
    show: nullableBoolType.optional(),
    order: z.number().nullable().optional(),
    /** `meta` is a JSON-text column on form-view-columns. */
    meta: z
      .union([z.record(z.unknown()), z.string()])
      .nullable()
      .optional(),
  })
  .strict();

export const formColumnUpdateSchema = z
  .object({
    formViewColumnId: z.string(),
    formViewColumn: formColumnBodySchema,
  })
  .strict();

export const showHideAllSchema = z
  .object({
    viewId: z.string(),
    /** Optional list of view-column IDs to leave untouched. */
    ignoreIds: z.array(z.string()).optional(),
    /** List-view scoping. */
    levelId: z.string().optional(),
  })
  .strict();

export const viewColumnsBulkSetVisibilitySchema = z
  .object({
    viewId: z.string(),
    /** view-column id → desired show flag. Strict booleans only. */
    columnVisibility: z.record(z.boolean()),
  })
  .strict();

export { boolType, nullableBoolType, viewColumnBodySchema };
