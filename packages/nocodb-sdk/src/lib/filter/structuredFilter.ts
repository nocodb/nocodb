import type UITypes from '~/lib/UITypes';
import {
  canEncodeQueryFilterToken,
  encodeQueryFilterToken,
} from '~/lib/parser/queryFilter/query-filter-encoder';
import {
  CALENDAR_PERIOD_SUB_OPS,
  DATE_RANGE_SUB_OP,
  IS_WITHIN_COMPARISON_SUB_OPS,
} from '~/lib/parser/queryFilter/query-filter-ops';

/**
 * Structured filters in the v3 shape (`{ field, operator, sub_operator, value }`,
 * `{ group_operator, filters }`), compiled to the `where` DSL the data services parse.
 * Shared by the MCP tools and the script runtime.
 */

// The operator vocabulary the string DSL documents, minus its internal aliases
// (`is`, `isnot`, `not`, `ge`, `le`, `gb_*`).
export const STRUCTURED_FILTER_OPERATORS = [
  'eq',
  'neq',
  'like',
  'nlike',
  'in',
  'gt',
  'lt',
  'gte',
  'lte',
  'btw',
  'nbtw',
  'blank',
  'notblank',
  'null',
  'notnull',
  'empty',
  'notempty',
  'checked',
  'notchecked',
  'allof',
  'anyof',
  'nallof',
  'nanyof',
  'isWithin',
] as const;

export const STRUCTURED_FILTER_SUB_OPERATORS = [
  'today',
  'tomorrow',
  'yesterday',
  'oneWeekAgo',
  'oneWeekFromNow',
  'oneMonthAgo',
  'oneMonthFromNow',
  'daysAgo',
  'daysFromNow',
  'exactDate',
  ...IS_WITHIN_COMPARISON_SUB_OPS,
] as const;

export type StructuredFilterOperator =
  (typeof STRUCTURED_FILTER_OPERATORS)[number];
export type StructuredFilterSubOperator =
  (typeof STRUCTURED_FILTER_SUB_OPERATORS)[number];

const VALUELESS_OPS = new Set([
  'blank',
  'notblank',
  'null',
  'notnull',
  'empty',
  'notempty',
  'checked',
  'notchecked',
]);

const LIST_OPS = new Set(['in', 'allof', 'anyof', 'nallof', 'nanyof']);
const RANGE_OPS = new Set(['btw', 'nbtw']);

// Sub-operators that name a moment on their own; the rest take a value.
const VALUELESS_SUB_OPS = new Set<string>([
  'today',
  'tomorrow',
  'yesterday',
  'oneWeekAgo',
  'oneWeekFromNow',
  'oneMonthAgo',
  'oneMonthFromNow',
  'pastWeek',
  'pastMonth',
  'pastYear',
  'nextWeek',
  'nextMonth',
  'nextYear',
  ...CALENDAR_PERIOD_SUB_OPS,
]);

// UITypes values as literals: importing UITypes would pull the formula helpers
// into the script runtime bundle.
const DATE_TYPES: string[] = [
  'Date',
  'DateTime',
  'CreatedTime',
  'LastModifiedTime',
] satisfies `${UITypes}`[];

// Computed fields that can be broken (colOptions.error) and that the filter
// path types by their result, not by uidt.
export const COMPUTED_TYPES: string[] = [
  'Lookup',
  'Rollup',
  'Formula',
] satisfies `${UITypes}`[];

// Lookups take a date comparison's value plainly, with no sub_operator.
const PLAIN_DATE_TYPES: string[] = ['Lookup'] satisfies `${UITypes}`[];

const MAX_CONDITIONS = 50;
const MAX_DEPTH = 5;

export type StructuredFilterValue =
  | string
  | number
  | boolean
  | ReadonlyArray<string | number>;

export interface StructuredFilterCondition {
  /** Field title (case-insensitive) or id, or an object carrying the id. */
  field: string | { id: string };
  operator: string;
  sub_operator?: string;
  value?: StructuredFilterValue | null;
}

export interface StructuredFilterGroup {
  group_operator: string;
  filters: ReadonlyArray<StructuredFilter>;
}

export type StructuredFilter =
  | StructuredFilterCondition
  | StructuredFilterGroup;

/** What the compiler needs of a column — a `Column` satisfies it. */
export interface FilterColumn {
  id?: string;
  title?: string;
  column_name?: string;
  uidt?: string;
  /** Set on a computed field whose definition is broken. */
  error?: string | null;
  /** A rollup's result type (`getRollupResultUidt`). */
  result_uidt?: string | null;
}

/** A filter the caller wrote wrong; the message says how to fix it. */
export class StructuredFilterError extends Error {}

const fail = (message: string): never => {
  throw new StructuredFilterError(message);
};

const isGroup = (node: unknown): node is StructuredFilterGroup =>
  !!node && typeof node === 'object' && 'group_operator' in node;

/**
 * The field a caller means by `ref`: its id, else its current title. Column
 * names are never matched — a renamed field keeps its old column name, so
 * accepting it would resolve to the wrong field.
 */
export function matchFieldRef<T extends FilterColumn>(
  columns: T[],
  ref: string
): T[] {
  const byId = columns.find((c) => c.id === ref);
  if (byId) return [byId];

  const exact = columns.filter((c) => c.title === ref);
  if (exact.length) return exact;

  return columns.filter((c) => c.title?.toLowerCase() === ref.toLowerCase());
}

export function resolveFieldRef<T extends FilterColumn>(
  columns: T[],
  ref: string
): T {
  const matches = matchFieldRef(columns, ref);

  if (matches.length === 1) return matches[0];

  if (matches.length > 1) {
    fail(
      `Field name '${ref}' matches ${matches.length} fields (${matches
        .map((c) => c.id)
        .join(', ')}). Pass the field id instead.`
    );
  }

  return fail(
    `Unknown filter field '${ref}'. Use a field title or ID from getTableSchema.`
  );
}

/**
 * Compile a structured filter to the `where` DSL (without the `@` prefix).
 *
 * Going through the string DSL rather than `filterArr` is deliberate: the
 * services accept `where` at every layer that matters (list, count, aggregate,
 * groupBy, and the optimised single-query paths), and every operator,
 * sub-operator and RLS interaction is already implemented against it. What the
 * structured input buys is validation the DSL cannot do — a field checked
 * against the table, a date comparison that names its sub-operator, values
 * quoted by the encoder written for the parser — so the caller gets a precise
 * refusal instead of a filter that silently means something else.
 *
 * Throws `StructuredFilterError`.
 */
export function compileStructuredFilter(
  columns: FilterColumn[],
  filter: unknown
): string {
  return compileNode(filter, columns, { count: 0 }, 0);
}

function compileNode(
  node: unknown,
  columns: FilterColumn[],
  state: { count: number },
  depth: number
): string {
  if (!isGroup(node)) {
    if (++state.count > MAX_CONDITIONS) {
      fail(`A filter may hold at most ${MAX_CONDITIONS} conditions`);
    }

    return compileLeaf(node as StructuredFilterCondition, columns);
  }

  if (depth >= MAX_DEPTH) {
    fail(`Filter groups may nest at most ${MAX_DEPTH} deep`);
  }

  if (!Array.isArray(node.filters) || !node.filters.length) {
    fail('A filter group needs at least one condition in `filters`');
  }

  // An unrecognised operator must not silently become AND.
  const operator = String(node.group_operator).toUpperCase();
  if (operator !== 'AND' && operator !== 'OR') {
    fail(
      `A filter group's group_operator must be "AND" or "OR", received ${JSON.stringify(
        node.group_operator
      )}`
    );
  }

  const joiner = operator === 'OR' ? '~or' : '~and';

  return node.filters
    .map((child) => {
      const compiled = compileNode(child, columns, state, depth + 1);
      // A leaf compiles to its own parenthesised clause; a group compiles to
      // the bare `(a)~and(b)` sequence and needs wrapping to nest.
      return isGroup(child) ? `(${compiled})` : compiled;
    })
    .join(joiner);
}

// The parser reads a bare `null`/`NULL` as SQL NULL; quoted, it stays text.
const encodeToken = (token: string | number): string =>
  token === 'null' || token === 'NULL'
    ? `"${token}"`
    : encodeQueryFilterToken(token);

function compileLeaf(
  leaf: StructuredFilterCondition,
  columns: FilterColumn[]
): string {
  if (!leaf?.field || !leaf?.operator) {
    fail('Each filter condition needs a `field` and an `operator`');
  }

  const ref = typeof leaf.field === 'string' ? leaf.field : leaf.field.id;
  const column = resolveFieldRef(columns, String(ref));

  // A broken lookup/rollup/formula matches nothing useful and the backend
  // drops the condition, so a read would return every row. Refuse instead.
  if (column.error) {
    fail(
      `Field '${column.title}' is broken (${column.error}), so a filter on it cannot run. Repair the field or remove the condition.`
    );
  }

  const op = leaf.operator;
  if (!(STRUCTURED_FILTER_OPERATORS as readonly string[]).includes(op)) {
    fail(
      `Unknown filter operator '${op}'. Use one of: ${STRUCTURED_FILTER_OPERATORS.join(
        ', '
      )}.`
    );
  }

  // A date rollup reads a sub_operator like a Date field; without one it keeps
  // comparing the plain value.
  const isDate =
    DATE_TYPES.includes(column.uidt ?? '') ||
    (!!leaf.sub_operator && DATE_TYPES.includes(column.result_uidt ?? ''));
  const values = normalizeValues(leaf, op, isDate);

  if (leaf.sub_operator && !isDate) {
    const plain = PLAIN_DATE_TYPES.includes(column.uidt ?? '')
      ? ` Pass the date as the value instead, with no sub_operator: (${column.title},gt,2026-03-01).`
      : '';
    fail(
      `sub_operator applies to Date fields only, and '${column.title}' is ${column.uidt}.${plain}`
    );
  }

  const tokens: (string | number)[] = [column.title ?? ''];

  if (isDate && !VALUELESS_OPS.has(op)) {
    tokens.push(dateSubOperator(column, leaf, op, values));
  } else if (op === 'isWithin') {
    fail(
      `isWithin applies to Date fields only, and '${column.title}' is ${column.uidt}`
    );
  }

  tokens.push(...values);

  for (const token of tokens) {
    if (!canEncodeQueryFilterToken(token)) {
      fail(
        `Cannot filter on a value containing both quote characters ('${token}') — the filter grammar cannot express it. Match a distinctive substring with 'like' instead.`
      );
    }
  }

  // The operator is a grammar keyword and is never quoted.
  const [field, ...args] = tokens.map(encodeToken);
  return `(${[field, op, ...args].join(',')})`;
}

/** The value slots for one condition, validated against its operator. */
function normalizeValues(
  leaf: StructuredFilterCondition,
  op: string,
  isDate: boolean
): (string | number)[] {
  const given = leaf.value;
  const list: (string | number)[] =
    given === undefined || given === null
      ? []
      : Array.isArray(given)
      ? [...(given as ReadonlyArray<string | number>)]
      : [
          typeof given === 'boolean'
            ? given
              ? 'true'
              : 'false'
            : (given as string | number),
        ];

  if (VALUELESS_OPS.has(op)) {
    if (list.length) {
      fail(`Operator '${op}' takes no value`);
    }
    return [];
  }

  if (RANGE_OPS.has(op)) {
    if (list.length !== 2) {
      fail(`Operator '${op}' needs exactly two values: [from, to]`);
    }
    return list;
  }

  if (LIST_OPS.has(op)) {
    if (!list.length) {
      fail(`Operator '${op}' needs at least one value`);
    }
    return list;
  }

  if (op === 'isWithin') return list;

  if (list.length > 1) {
    fail(`Operator '${op}' takes a single value; use 'in' for a list`);
  }

  // On a date field whether a value is needed depends on the sub-operator
  // ('today' takes none, 'exactDate' takes one) — `dateSubOperator` decides.
  if (!list.length && !isDate) {
    fail(
      `Operator '${op}' needs a value. Use 'blank' or 'notblank' to test for no value.`
    );
  }

  return list;
}

/**
 * The sub-operator slot a date comparison must fill.
 *
 * The parser reads the first value after the operator as the sub-operator for
 * date-typed fields, so a bare `2026-06-01` there is rejected as an unknown
 * sub-operator — the single most common way the string DSL is got wrong.
 */
function dateSubOperator(
  column: FilterColumn,
  leaf: StructuredFilterCondition,
  op: string,
  values: (string | number)[]
): string {
  const subOp = leaf.sub_operator;

  if (RANGE_OPS.has(op)) {
    // The V3 parser folds every value after the operator into the
    // sub-operator + one value, so a two-ended date range cannot survive it.
    fail(
      `Operator '${op}' is not supported on the Date field '${column.title}'. Use two conditions instead: gte with the start and lte with the end.`
    );
  }

  if (!subOp) {
    return fail(
      `'${column.title}' is a ${column.uidt} field, so '${op}' needs a sub_operator. ` +
        `For a calendar date use sub_operator 'exactDate' with value '2026-06-01'; ` +
        `for a relative one use today, yesterday, oneWeekAgo, daysAgo, …`
    );
  }

  const isWithinSubOp = (
    IS_WITHIN_COMPARISON_SUB_OPS as readonly string[]
  ).includes(subOp);

  if (op === 'isWithin' && !isWithinSubOp) {
    fail(
      `sub_operator '${subOp}' is not valid for isWithin. Use one of: ${IS_WITHIN_COMPARISON_SUB_OPS.join(
        ', '
      )}.`
    );
  }

  if (op !== 'isWithin' && isWithinSubOp) {
    fail(`sub_operator '${subOp}' only works with operator isWithin`);
  }

  if (VALUELESS_SUB_OPS.has(subOp) && values.length) {
    fail(`sub_operator '${subOp}' takes no value`);
  }

  if (subOp === DATE_RANGE_SUB_OP) {
    if (values.length !== 2 || values.some((v) => `${v}`.trim() === '')) {
      fail(
        `sub_operator 'dateRange' needs [from, to], like ['2026-06-01', '2026-06-30']`
      );
    }
  } else if (!VALUELESS_SUB_OPS.has(subOp) && !values.length) {
    fail(
      `sub_operator '${subOp}' needs a value${
        subOp === 'exactDate' ? " like '2026-06-01'" : ' — a number of days'
      }`
    );
  }

  return subOp;
}
