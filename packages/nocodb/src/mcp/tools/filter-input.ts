import { extractFilterFromXwhere } from 'nocodb-sdk';
import type { FilterType, NcContext, UITypes } from 'nocodb-sdk';
import { compileFilterTree, COMPUTED_TYPES } from '~/mcp/tools/filter-compile';
import { Model } from '~/models';
import { NcError } from '~/helpers/catchError';

export * from '~/mcp/tools/filter-compile';

/** `compileFilterTree` against the columns of one table. */
export async function compileFilterInput(
  context: NcContext,
  tableId: string,
  filter: unknown,
): Promise<string> {
  const model = await Model.get(context, tableId);

  if (!model) {
    NcError.get(context).tableNotFound(tableId);
  }

  const columns = await model.getColumns();
  const filterColumns = await Promise.all(
    columns.map(async (c) => {
      const colOptions = COMPUTED_TYPES.includes(c.uidt as UITypes)
        ? await c.getColOptions<{
            error?: string | null;
            result_uidt?: string;
          }>()
        : null;
      return {
        id: c.id,
        title: c.title,
        column_name: c.column_name,
        uidt: c.uidt,
        error: colOptions?.error,
        result_uidt: colOptions?.result_uidt,
      };
    }),
  );

  return compileFilterTree(context, filterColumns, filter);
}

/**
 * The `where` a read tool should run with. Accepts either input and refuses
 * both, so a call that sets them inconsistently is never silently resolved one
 * way.
 */
export async function resolveWhere(
  context: NcContext,
  tableId: string,
  args: { where?: string; filter?: unknown },
): Promise<string | undefined> {
  if (args.where && args.filter) {
    NcError.get(context).badRequest(
      'Pass either `filter` (structured) or `where` (string), not both',
    );
  }

  if (args.filter) {
    return compileFilterInput(context, tableId, args.filter);
  }

  if (!args.where) return args.where;

  const where = normalizeWhere(args.where);
  await assertWhereParses(context, tableId, where);
  return where;
}

// `) and (`, `) ~and (`, `)~AND(` — only between two conditions (the next
// group holds a comma), so a value containing the word is left alone.
const LOOSE_JOIN = /\)\s*~?\s*(and|or)\s*(~?\s*not\s*)?\((?=[^()]*,)/gi;
// Whitespace around the field and operator, and before the value. Only where a
// condition can start (string start, a group, or after a join), so a value
// holding `(x, y)` is left alone.
const LOOSE_CONDITION =
  /(?<=^\s*@?|\(|~(?:and|or|not))\(\s*([^,()~]+?)\s*,\s*([A-Za-z]+)\s*(?:(,)\s*|(\)))/g;

/**
 * The join syntax the parser expects. Anything else parses as one condition
 * whose value swallows the rest of the string, and quietly matches nothing.
 */
export function normalizeWhere(where: string): string {
  return where
    .replace(
      LOOSE_JOIN,
      (_, op: string, not?: string) =>
        `)~${op.toLowerCase()}${not ? '~not' : ''}(`,
    )
    .replace(
      LOOSE_CONDITION,
      (_, field: string, op: string, comma?: string, close?: string) =>
        `(${field},${op}${comma ?? close}`,
    );
}

/**
 * Some data-layer readers parse `where` non-strictly and run unfiltered on a
 * parse error, so refuse it before it gets there.
 */
async function assertWhereParses(
  context: NcContext,
  tableId: string,
  where: string,
): Promise<void> {
  const model = await Model.get(context, tableId);

  if (!model) {
    NcError.get(context).tableNotFound(tableId);
  }

  try {
    extractFilterFromXwhere(
      context,
      where,
      await model.getAliasColObjMap(await model.getColumns()),
      true,
    );
  } catch (e) {
    NcError.get(context).badRequest(
      `Invalid \`where\`: ${e?.message ?? e}. Expected ` +
        '`(field,op,value)` joined by `~and` / `~or`, e.g. ' +
        '`(Status,eq,Done)~and(Priority,gt,2)`.',
    );
  }
}

function countConditions(filters: FilterType[] = []): number {
  return filters.reduce(
    (n, f) => n + (f.is_group ? countConditions(f.children) : 1),
    0,
  );
}

/**
 * Leaf conditions in `where`, parsed the way the data layer parses it. A
 * truthy string can still compile to none — `"@"` does — and an empty
 * condition is no WHERE clause at all.
 */
export async function countWhereConditions(
  context: NcContext,
  tableId: string,
  where: string | undefined,
): Promise<number> {
  if (!where) return 0;

  const model = await Model.get(context, tableId);

  if (!model) {
    NcError.get(context).tableNotFound(tableId);
  }

  const { filters } = extractFilterFromXwhere(
    context,
    where,
    await model.getAliasColObjMap(await model.getColumns()),
    true,
  );

  return countConditions(filters);
}
