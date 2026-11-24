import { z } from 'zod';
import {
  compileStructuredFilter,
  IS_WITHIN_COMPARISON_SUB_OPS,
  resolveFieldRef as resolveStructuredFieldRef,
  STRUCTURED_FILTER_OPERATORS,
  STRUCTURED_FILTER_SUB_OPERATORS,
  StructuredFilterError,
} from 'nocodb-sdk';
import type { FilterColumn, NcContext } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';

export { COMPUTED_TYPES, matchFieldRef } from 'nocodb-sdk';
export type { FilterColumn } from 'nocodb-sdk';

const leafSchema = z.object({
  field: z
    .string()
    .describe(
      'Field title (case-insensitive) or field ID. Called `field_id` on createFilter.',
    ),
  operator: z.enum(STRUCTURED_FILTER_OPERATORS).describe('Comparison operator'),
  sub_operator: z
    .enum(STRUCTURED_FILTER_SUB_OPERATORS)
    .optional()
    .describe(
      'Date/DateTime fields only, and required there for every comparison: how the value is read. ' +
        'A rollup returning a date (min/max over a Date field) takes one too. ' +
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
      'Scalar for most operators. Array for in/allof/anyof/nallof/nanyof, and exactly two entries [from, to] for btw/nbtw. ' +
        'btw/nbtw work on numeric fields, both bounds inclusive; on a Date field use two conditions with gte and lte. ' +
        'Omit for blank/notblank/null/notnull/empty/notempty/checked/notchecked. ' +
        "Values are literal: 'null' matches the text null. To match empty cells use operator blank (or null), not value 'null'.",
    ),
});

// Nested groups are accepted as loose objects so the advertised JSON Schema
// stays finite (the same trade-off `filters.tools.ts` makes on the write side);
// the compiler walks the real tree and rejects anything malformed.
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

/** Runs the shared compiler, turning its refusals into a 400 for this request. */
function asNcError<T>(context: NcContext, run: () => T): T {
  try {
    return run();
  } catch (e) {
    if (e instanceof StructuredFilterError) {
      NcError.get(context).badRequest(e.message);
    }
    throw e;
  }
}

export function resolveFieldRef(
  context: NcContext,
  columns: FilterColumn[],
  ref: string,
): FilterColumn {
  return asNcError(context, () => resolveStructuredFieldRef(columns, ref));
}

/**
 * Compile a structured filter to the `where` string the data services parse.
 * Takes the column list rather than a table id so the rules can be tested
 * without loading the model graph.
 */
export function compileFilterTree(
  context: NcContext,
  columns: FilterColumn[],
  filter: unknown,
): string {
  const compiled = asNcError(context, () =>
    compileStructuredFilter(columns, filter),
  );

  // `@` opts the string into the grammar this compiler targets. Without it the
  // dispatch in `extractFilterFromXwhere` falls back to the legacy regex parser
  // whenever the context carries no `api_version` — which is the case on the
  // MCP path — and the legacy parser does not strip quotes, so every quoted
  // field name or value silently matches nothing.
  return `@${compiled}`;
}
