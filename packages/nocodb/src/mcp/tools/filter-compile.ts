import { z } from 'zod';
import {
  canEncodeQueryFilterToken,
  encodeQueryFilterToken,
  IS_WITHIN_COMPARISON_SUB_OPS,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';

// The operator vocabulary the string DSL documents, minus its internal aliases
// (`is`, `isnot`, `not`, `ge`, `le`, `gb_*`). Advertised as an enum so a client
// rejects a typo locally instead of round-tripping to a parse error.
const OPERATORS = [
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

const SUB_OPERATORS = [
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
const VALUELESS_SUB_OPS = new Set([
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
]);

const DATE_TYPES = [
  UITypes.Date,
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
];

const MAX_CONDITIONS = 50;
const MAX_DEPTH = 5;

const leafSchema = z.object({
  field: z
    .string()
    .describe(
      'Field title (case-insensitive) or field ID. Called `field_id` on createFilter.',
    ),
  operator: z.enum(OPERATORS).describe('Comparison operator'),
  sub_operator: z
    .enum(SUB_OPERATORS)
    .optional()
    .describe(
      'Date/DateTime fields only, and required there for every comparison: how the value is read. ' +
        "Use 'exactDate' with value '2026-06-01' for a calendar date; 'today'/'yesterday'/'oneWeekAgo' take no value; " +
        "'daysAgo'/'daysFromNow' take a number. With operator isWithin use one of: " +
        `${IS_WITHIN_COMPARISON_SUB_OPS.join(', ')}.`,
    ),
  value: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.union([z.string(), z.number()])),
    ])
    .optional()
    .describe(
      'Scalar for most operators. Array for in/allof/anyof/nallof/nanyof, and exactly two entries for btw/nbtw. ' +
        'Omit for blank/notblank/null/notnull/empty/notempty/checked/notchecked.',
    ),
});

// Nested groups are accepted as loose objects so the advertised JSON Schema
// stays finite (the same trade-off `filters.tools.ts` makes on the write side);
// the compiler below walks the real tree and rejects anything malformed.
const groupSchema = z.object({
  group_operator: z
    .enum(['AND', 'OR'])
    .describe('How the members of this group combine'),
  filters: z
    .array(z.union([leafSchema, z.record(z.string(), z.unknown())]))
    .describe('Leaf conditions and/or nested groups'),
});

export const filterInputSchema = z.union([leafSchema, groupSchema]);

export const filterInputDescription =
  'Structured filter — the same shape as createFilter: a single condition ' +
  '{ field, operator, value }, or a group { group_operator: "AND"|"OR", filters: [...] } ' +
  'whose members may themselves be groups. Field names and values are quoted for you, so ' +
  'commas, parentheses and quotes in either are safe. Prefer this over `where`; pass only one of the two.';

/** What the compiler needs of a column — a `Column` satisfies it. */
export interface FilterColumn {
  id?: string;
  title?: string;
  column_name?: string;
  uidt?: string;
}

type FilterLeaf = z.infer<typeof leafSchema>;
type FilterNode = FilterLeaf | { group_operator: string; filters: unknown[] };

function isGroup(node: unknown): node is {
  group_operator: string;
  filters: unknown[];
} {
  return !!node && typeof node === 'object' && 'group_operator' in node;
}

/**
 * Compile a structured filter to the `where` string the data services already
 * parse.
 *
 * Going through the string DSL rather than `filterArr` is deliberate: the
 * services accept `where` at every layer that matters (list, count, aggregate,
 * groupBy, and the optimised single-query paths), and every operator,
 * sub-operator and RLS interaction is already implemented against it. What the
 * structured input buys is validation the DSL cannot do — a field checked
 * against the table, a date comparison that names its sub-operator, values
 * quoted by the encoder written for the parser — so the model gets a precise
 * refusal instead of a filter that silently means something else.
 *
 * Takes the column list rather than a table id so the rules can be tested
 * without loading the model graph.
 */
export function compileFilterTree(
  context: NcContext,
  columns: FilterColumn[],
  filter: unknown,
): string {
  const byKey = new Map<string, FilterColumn>();
  for (const column of columns) {
    if (column.id) byKey.set(column.id, column);
    if (column.title) byKey.set(column.title.toLowerCase(), column);
    if (column.column_name) {
      byKey.set(column.column_name.toLowerCase(), column);
    }
  }

  const state = { count: 0 };
  const compiled = compileNode(context, filter as FilterNode, byKey, state, 0);

  // `@` opts the string into the grammar this compiler targets. Without it the
  // dispatch in `extractFilterFromXwhere` falls back to the legacy regex parser
  // whenever the context carries no `api_version` — which is the case on the
  // MCP path — and the legacy parser does not strip quotes, so every quoted
  // field name or value silently matches nothing.
  return `@${compiled}`;
}

function compileNode(
  context: NcContext,
  node: FilterNode,
  byKey: Map<string, FilterColumn>,
  state: { count: number },
  depth: number,
): string {
  if (!isGroup(node)) {
    if (++state.count > MAX_CONDITIONS) {
      NcError.get(context).badRequest(
        `A filter may hold at most ${MAX_CONDITIONS} conditions`,
      );
    }
    return compileLeaf(context, node as FilterLeaf, byKey);
  }

  if (depth >= MAX_DEPTH) {
    NcError.get(context).badRequest(
      `Filter groups may nest at most ${MAX_DEPTH} deep`,
    );
  }

  if (!Array.isArray(node.filters) || !node.filters.length) {
    NcError.get(context).badRequest(
      'A filter group needs at least one condition in `filters`',
    );
  }

  // Only the top-level group is enum-validated by the schema; a nested one
  // arrives as a loose object, so an unrecognised operator would silently
  // become AND — a wrong answer with no error, which is the worst outcome on
  // this surface.
  const operator = String(node.group_operator).toUpperCase();
  if (operator !== 'AND' && operator !== 'OR') {
    NcError.get(context).badRequest(
      `A filter group's group_operator must be "AND" or "OR", received ${JSON.stringify(
        node.group_operator,
      )}`,
    );
  }

  const joiner = operator === 'OR' ? '~or' : '~and';

  return node.filters
    .map((child) => {
      const compiled = compileNode(
        context,
        child as FilterNode,
        byKey,
        state,
        depth + 1,
      );
      // A leaf compiles to its own parenthesised clause; a group compiles to
      // the bare `(a)~and(b)` sequence and needs wrapping to nest.
      return isGroup(child) ? `(${compiled})` : compiled;
    })
    .join(joiner);
}

function compileLeaf(
  context: NcContext,
  leaf: FilterLeaf,
  byKey: Map<string, FilterColumn>,
): string {
  const ncError = NcError.get(context);

  if (!leaf?.field || !leaf?.operator) {
    ncError.badRequest(
      'Each filter condition needs a `field` and an `operator`',
    );
  }

  const column =
    byKey.get(leaf.field) ?? byKey.get(String(leaf.field).toLowerCase());

  if (!column) {
    ncError.badRequest(
      `Unknown filter field '${leaf.field}'. Use a field title or ID from getTableSchema.`,
    );
  }

  const op = leaf.operator;
  const isDate = DATE_TYPES.includes(column.uidt as UITypes);
  const values = normalizeValues(context, leaf, op, isDate);

  if (leaf.sub_operator && !isDate) {
    ncError.badRequest(
      `sub_operator applies to Date fields only, and '${column.title}' is ${column.uidt}`,
    );
  }

  const tokens: (string | number)[] = [column.title, op];

  if (isDate && !VALUELESS_OPS.has(op)) {
    tokens.push(dateSubOperator(context, column, leaf, op, values));
  } else if (op === 'isWithin') {
    ncError.badRequest(
      `isWithin applies to Date fields only, and '${column.title}' is ${column.uidt}`,
    );
  }

  tokens.push(...values);

  for (const token of tokens) {
    if (!canEncodeQueryFilterToken(token)) {
      ncError.badRequest(
        `Cannot filter on a value containing both quote characters ('${token}') — the filter grammar cannot express it. Match a distinctive substring with 'like' instead.`,
      );
    }
  }

  return `(${tokens.map((t) => encodeQueryFilterToken(t)).join(',')})`;
}

/** The value slots for one condition, validated against its operator. */
function normalizeValues(
  context: NcContext,
  leaf: FilterLeaf,
  op: string,
  isDate: boolean,
): (string | number)[] {
  const ncError = NcError.get(context);
  const given = leaf.value;
  const list =
    given === undefined || given === null
      ? []
      : Array.isArray(given)
      ? given
      : [typeof given === 'boolean' ? (given ? 'true' : 'false') : given];

  if (VALUELESS_OPS.has(op)) {
    if (list.length) {
      ncError.badRequest(`Operator '${op}' takes no value`);
    }
    return [];
  }

  if (RANGE_OPS.has(op)) {
    if (list.length !== 2) {
      ncError.badRequest(
        `Operator '${op}' needs exactly two values: [from, to]`,
      );
    }
    return list;
  }

  if (LIST_OPS.has(op)) {
    if (!list.length) {
      ncError.badRequest(`Operator '${op}' needs at least one value`);
    }
    return list;
  }

  if (op === 'isWithin') return list;

  if (list.length > 1) {
    ncError.badRequest(
      `Operator '${op}' takes a single value; use 'in' for a list`,
    );
  }

  // On a date field whether a value is needed depends on the sub-operator
  // ('today' takes none, 'exactDate' takes one) — `dateSubOperator` decides.
  if (!list.length && !isDate) {
    ncError.badRequest(
      `Operator '${op}' needs a value. Use 'blank' or 'notblank' to test for no value.`,
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
  context: NcContext,
  column: FilterColumn,
  leaf: FilterLeaf,
  op: string,
  values: (string | number)[],
): string {
  const ncError = NcError.get(context);
  const subOp = leaf.sub_operator;

  if (RANGE_OPS.has(op)) {
    // The V3 parser folds every value after the operator into the
    // sub-operator + one value, so a two-ended date range cannot survive it.
    ncError.badRequest(
      `Operator '${op}' is not supported on the Date field '${column.title}'. Use two conditions instead: gte with the start and lte with the end.`,
    );
  }

  if (!subOp) {
    ncError.badRequest(
      `'${column.title}' is a ${column.uidt} field, so '${op}' needs a sub_operator. ` +
        `For a calendar date use sub_operator 'exactDate' with value '2026-06-01'; ` +
        `for a relative one use today, yesterday, oneWeekAgo, daysAgo, …`,
    );
  }

  const isWithinSubOp = (
    IS_WITHIN_COMPARISON_SUB_OPS as readonly string[]
  ).includes(subOp);

  if (op === 'isWithin' && !isWithinSubOp) {
    ncError.badRequest(
      `sub_operator '${subOp}' is not valid for isWithin. Use one of: ${IS_WITHIN_COMPARISON_SUB_OPS.join(
        ', ',
      )}.`,
    );
  }

  if (op !== 'isWithin' && isWithinSubOp) {
    ncError.badRequest(
      `sub_operator '${subOp}' only works with operator isWithin`,
    );
  }

  if (VALUELESS_SUB_OPS.has(subOp) && values.length) {
    ncError.badRequest(`sub_operator '${subOp}' takes no value`);
  }

  if (!VALUELESS_SUB_OPS.has(subOp) && !values.length) {
    ncError.badRequest(
      `sub_operator '${subOp}' needs a value${
        subOp === 'exactDate' ? " like '2026-06-01'" : ' — a number of days'
      }`,
    );
  }

  return subOp;
}
