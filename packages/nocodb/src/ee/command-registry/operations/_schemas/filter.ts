import { z } from 'zod';

/**
 * `comparison_op` enum from `FilterReqType`. Matches the runtime list
 * `Filter.insert` accepts — operators outside this set would fail at
 * filter-evaluation time anyway.
 */
const COMPARISON_OPS = [
  'allof',
  'anyof',
  'blank',
  'btw',
  'checked',
  'empty',
  'eq',
  'ge',
  'gt',
  'gte',
  'in',
  'is',
  'isWithin',
  'isnot',
  'le',
  'like',
  'lt',
  'lte',
  'nallof',
  'nanyof',
  'nbtw',
  'neq',
  'nlike',
  'not',
  'notblank',
  'notchecked',
  'notempty',
  'notnull',
  'null',
] as const;

/**
 * `comparison_sub_op` enum from `FilterReqType`. Refines date-comparison
 * operators (`isWithin`, etc.).
 */
const COMPARISON_SUB_OPS = [
  'daysAgo',
  'daysFromNow',
  'exactDate',
  'nextMonth',
  'nextNumberOfDays',
  'nextWeek',
  'nextYear',
  'oneMonthAgo',
  'oneMonthFromNow',
  'oneWeekAgo',
  'oneWeekFromNow',
  'pastMonth',
  'pastNumberOfDays',
  'pastWeek',
  'pastYear',
  'today',
  'tomorrow',
  'yesterday',
] as const;

const LOGICAL_OPS = ['and', 'not', 'or'] as const;

/**
 * `BoolType` from SDK = `boolean | 0 | 1`. Filter rows store this on the
 * `is_group` and `enabled` columns.
 */
const boolType = z.union([z.boolean(), z.literal(0), z.literal(1)]);

/**
 * `value` is genuinely polymorphic — the runtime type depends on
 * `comparison_op` (string for `eq`, array for `in`, ISO date for
 * `isWithin`, etc.). Constrained to a flat sum of JSON-serializable types
 * so we don't accept arbitrary nested structures.
 */
const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
]);

/** Recursive shape for filter-group descendants — `z.lazy` to compile the recursion. */
const filterChildSchema: z.ZodType<Record<string, unknown>> = z.lazy(
  () => filterBodySchema,
);

export const filterBodySchema = z
  .object({
    // ── API surface (FilterReqType) ──────────────────────────────
    comparison_op: z.enum(COMPARISON_OPS).nullable().optional(),
    comparison_sub_op: z.enum(COMPARISON_SUB_OPS).nullable().optional(),
    logical_op: z.enum(LOGICAL_OPS).optional(),
    fk_column_id: z.string().nullable().optional(),
    fk_widget_id: z.string().nullable().optional(),
    fk_parent_id: z.string().nullable().optional(),
    is_group: boolType.optional(),
    value: filterValueSchema.optional(),
    enabled: boolType.optional(),
    fk_level_id: z.string().nullable().optional(),

    // ── Parent-FK fields set by the parent-scoped create ops ─────
    fk_view_id: z.string().nullable().optional(),
    fk_hook_id: z.string().nullable().optional(),
    fk_link_col_id: z.string().nullable().optional(),
    fk_value_col_id: z.string().nullable().optional(),
    fk_parent_column_id: z.string().nullable().optional(),
    fk_row_color_condition_id: z.string().nullable().optional(),
    fk_button_col_id: z.string().nullable().optional(),
    fk_rls_policy_id: z.string().nullable().optional(),

    // ── Replay / recurse / audit fields ──────────────────────────
    /** Injected by the dispatcher under replay (`idField: 'filter'`). */
    id: z.string().optional(),
    order: z.number().optional(),
    /** Filter.meta is a `text` column; arbitrary JSON object. */
    meta: z.record(z.unknown()).nullable().optional(),
    /** Recursive descendants for filter-group restoration. */
    children: z.array(filterChildSchema).optional(),
  })
  .strict();

// ── Top-level contract schemas ────────────────────────────────

export const filterCreateSchema = z
  .object({
    viewId: z.string(),
    filter: filterBodySchema,
  })
  .strict();

export const filterUpdateSchema = z
  .object({
    filterId: z.string(),
    filter: filterBodySchema,
  })
  .strict();

export const filterDeleteSchema = z
  .object({
    filterId: z.string(),
  })
  .strict();

export const linkFilterCreateSchema = z
  .object({
    columnId: z.string(),
    filter: filterBodySchema,
  })
  .strict();

export const buttonFilterCreateSchema = z
  .object({
    buttonColId: z.string(),
    filter: filterBodySchema,
  })
  .strict();

export const widgetFilterCreateSchema = z
  .object({
    widgetId: z.string(),
    filter: filterBodySchema,
  })
  .strict();

export const rowColorConditionsCreateSchema = z
  .object({
    rowColorConditionsId: z.string(),
    filter: filterBodySchema,
  })
  .strict();
