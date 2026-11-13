import {
  AttachmentAggregations,
  BooleanAggregations,
  CommonAggregations,
  NumericalAggregations,
  getColumnAggregations,
  getLegacyDateRollupAggregation,
  isDateValuedAggregation,
} from '~/lib/aggregationHelper';
import type { ColumnType } from '~/lib/Api';

/**
 * Kanban per-stack summary ("Summarize"). Native Kanban views store it on
 * `nc_kanban_view_v2` (`summary_fn`, `fk_summary_col_id`, `summary_label`,
 * `summary_colors`); interface Kanban vizzes keep the same shape as
 * `stack_summary` on the viz config.
 */
export type KanbanSummaryLabelMode = 'none' | 'function' | 'custom';

export interface KanbanSummaryLabel {
  mode: KanbanSummaryLabelMode;
  text?: string;
}

export type KanbanSummaryColorOp = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

export interface KanbanSummaryColorCondition {
  op: KanbanSummaryColorOp;
  value: number | null;
}

export interface KanbanSummaryColorRule {
  id: string;
  /** A hex colour, as the colour picker gives it. */
  color: string;
  /** All must match. */
  conditions: KanbanSummaryColorCondition[];
}

export interface KanbanSummaryColors {
  /** First matching rule wins. */
  rules: KanbanSummaryColorRule[];
  default_color?: string | null;
}

export interface KanbanStackSummary {
  /** An aggregation key; `count` is the record count and takes no field. */
  fn: string;
  fk_column_id?: string | null;
  label?: KanbanSummaryLabel | null;
  colors?: KanbanSummaryColors | null;
}

export const KANBAN_SUMMARY_COUNT = CommonAggregations.Count as string;

/** Response key carrying a hidden summary field's display info (title, type, format). */
export const KANBAN_SUMMARY_COLUMN_KEY = '__nc_summary_column';

export const KANBAN_SUMMARY_COLOR_OPS: KanbanSummaryColorOp[] = [
  'gt',
  'gte',
  'lt',
  'lte',
  'eq',
  'neq',
];

// A date rollup runs these as earliest / latest / date range.
const DATE_ROLLUP_ALIASES: string[] = [
  NumericalAggregations.Min,
  NumericalAggregations.Max,
  NumericalAggregations.Range,
];

/** Aggregations a Kanban summary can run on `column` (None excluded). */
export const getKanbanSummaryFunctions = (
  column?: Pick<ColumnType, 'uidt' | 'colOptions'> | null
): string[] => {
  if (!column?.uidt) return [];
  const aggregations = getColumnAggregations(column).filter(
    (a) => a !== CommonAggregations.None
  );
  const aliases = DATE_ROLLUP_ALIASES.filter(
    (a) =>
      !aggregations.includes(a) && getLegacyDateRollupAggregation(column, a)
  );
  return [...aggregations, ...aliases];
};

export const isKanbanSummaryFnValid = (
  fn: string | null | undefined,
  column?: Pick<ColumnType, 'uidt' | 'colOptions'> | null
): boolean => {
  if (!fn) return false;
  if (fn === KANBAN_SUMMARY_COUNT) return true;
  return getKanbanSummaryFunctions(column).includes(fn);
};

// Each combines many records into one number, so it may total a field the
// viewer can't see. An allowlist: a new aggregation stays off until added here.
const HIDDEN_SAFE_FUNCTIONS: string[] = [
  ...Object.values(CommonAggregations).filter(
    (a) => a !== CommonAggregations.None
  ),
  ...Object.values(BooleanAggregations),
  NumericalAggregations.Sum,
  NumericalAggregations.Avg,
  NumericalAggregations.StandardDeviation,
  AttachmentAggregations.AttachmentSize,
];

/**
 * Whether a summary may total a field hidden from the viewer. Sum, Average and
 * the counts combine many records; a stack holding a single card still shows
 * that card's value, which the owner accepts by summarising a hidden field.
 */
export const isKanbanSummaryFnSafeWhenHidden = (
  fn: string | null | undefined
): boolean => !!fn && HIDDEN_SAFE_FUNCTIONS.includes(fn);

/** Colour rules compare numbers; a date-valued result can't use them. */
export const kanbanSummarySupportsColors = (
  fn: string | null | undefined,
  column?: Pick<ColumnType, 'uidt' | 'colOptions'> | null
): boolean => {
  if (!fn) return false;
  if (fn === KANBAN_SUMMARY_COUNT || !column) return true;
  return !isDateValuedAggregation(column, fn);
};

const conditionMatches = (
  value: number,
  condition: KanbanSummaryColorCondition
): boolean => {
  if (condition.value === null || condition.value === undefined) return false;
  const target = Number(condition.value);
  if (!Number.isFinite(target)) return false;
  switch (condition.op) {
    case 'gt':
      return value > target;
    case 'gte':
      return value >= target;
    case 'lt':
      return value < target;
    case 'lte':
      return value <= target;
    case 'eq':
      return value === target;
    case 'neq':
      return value !== target;
    default:
      return false;
  }
};

/** A rule with no usable condition never matches. */
const matches = (value: number, rule: KanbanSummaryColorRule): boolean => {
  const conditions = rule.conditions ?? [];
  return (
    conditions.length > 0 &&
    conditions.every((condition) => conditionMatches(value, condition))
  );
};

/** Colour for a stack's summary value: first matching rule, else the default. */
export const getKanbanSummaryColor = (
  value: unknown,
  colors?: KanbanSummaryColors | null
): string | null => {
  if (!colors) return null;
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : NaN;
  if (Number.isFinite(num)) {
    const hit = (colors.rules ?? []).find((rule) => matches(num, rule));
    if (hit) return hit.color;
  }
  return colors.default_color ?? null;
};

const parseJson = <T extends object>(value: unknown): Partial<T> | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value as Partial<T>;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value) as Partial<T>;
  } catch {
    return null;
  }
};

/** Kanban view row (`summary_*` columns) → summary config; null when unset. */
export const kanbanSummaryFromView = (
  view?: {
    summary_fn?: string | null;
    fk_summary_col_id?: string | null;
    summary_label?: unknown;
    summary_colors?: unknown;
  } | null
): KanbanStackSummary | null => {
  if (!view?.summary_fn) return null;
  return {
    fn: view.summary_fn,
    fk_column_id:
      view.summary_fn === KANBAN_SUMMARY_COUNT
        ? null
        : view.fk_summary_col_id ?? null,
    label: normalizeLabel(parseJson(view.summary_label)),
    colors: normalizeColors(parseJson(view.summary_colors)),
  };
};

const LABEL_MODES: KanbanSummaryLabelMode[] = ['none', 'function', 'custom'];

// Native views store free-form JSON: keep only the documented shape.
const normalizeLabel = (
  label: Partial<KanbanSummaryLabel> | null
): KanbanSummaryLabel | null => {
  if (!label || typeof label !== 'object') return null;
  if (!LABEL_MODES.includes(label.mode as KanbanSummaryLabelMode)) return null;
  return {
    mode: label.mode as KanbanSummaryLabelMode,
    ...(typeof label.text === 'string'
      ? { text: label.text.slice(0, 255) }
      : {}),
  };
};

const normalizeColors = (
  colors: Partial<KanbanSummaryColors> | null
): KanbanSummaryColors | null => {
  if (!colors || typeof colors !== 'object') return null;
  const rules = (Array.isArray(colors.rules) ? colors.rules : [])
    .filter((rule) => rule && typeof rule.color === 'string')
    .slice(0, 20)
    .map((rule) => ({
      id: String(rule.id ?? ''),
      color: rule.color.slice(0, 32),
      conditions: (Array.isArray(rule.conditions) ? rule.conditions : [])
        .filter((c) => c && KANBAN_SUMMARY_COLOR_OPS.includes(c.op))
        .slice(0, 10)
        .map((c) => ({
          op: c.op,
          value:
            typeof c.value === 'number' && Number.isFinite(c.value)
              ? c.value
              : null,
        })),
    }));
  const default_color =
    typeof colors.default_color === 'string'
      ? colors.default_color.slice(0, 32)
      : null;
  return rules.length || default_color ? { rules, default_color } : null;
};

/** Summary config → kanban view row fields; null clears all four. */
export const kanbanSummaryToView = (
  summary?: KanbanStackSummary | null
): {
  summary_fn: string | null;
  fk_summary_col_id: string | null;
  summary_label: string | null;
  summary_colors: string | null;
} => {
  if (!summary?.fn) {
    return {
      summary_fn: null,
      fk_summary_col_id: null,
      summary_label: null,
      summary_colors: null,
    };
  }
  return {
    summary_fn: summary.fn,
    fk_summary_col_id:
      summary.fn === KANBAN_SUMMARY_COUNT ? null : summary.fk_column_id ?? null,
    summary_label: summary.label ? JSON.stringify(summary.label) : null,
    summary_colors:
      summary.colors?.rules?.length || summary.colors?.default_color
        ? JSON.stringify(summary.colors)
        : null,
  };
};
