import { extractFilterFromXwhere } from 'nocodb-sdk';
import type { FilterType, NcContext } from 'nocodb-sdk';
import { compileFilterTree } from '~/mcp/tools/filter-compile';
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

  return compileFilterTree(context, await model.getColumns(), filter);
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

  return args.where;
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
