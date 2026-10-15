import type { COMPARISON_OPS, COMPARISON_SUB_OPS, NcContext } from 'nocodb-sdk';
import { Model } from '~/models';
import { NcError } from '~/helpers/catchError';
import { resolveFieldRef } from '~/mcp/tools/filter-compile';

type FilterOperator = (typeof COMPARISON_OPS)[number];
type FilterSubOperator = (typeof COMPARISON_SUB_OPS)[number];

export type FilterInputLeaf = {
  field_id: string;
  operator: FilterOperator;
  sub_operator?: FilterSubOperator | null;
  value?: unknown;
};

export type FilterInputNode =
  | FilterInputLeaf
  | { group_operator?: 'AND' | 'OR'; filters: FilterInputNode[] };

/**
 * Resolve every `field_id` (id or title) to a field id. FiltersV3Service
 * refuses what the read path would refuse.
 */
export async function resolveViewFilter(
  context: NcContext,
  tableId: string,
  filter: FilterInputNode,
): Promise<FilterInputNode> {
  const model = await Model.get(context, tableId);
  if (!model) NcError.get(context).tableNotFound(tableId);
  const columns = await model.getColumns();

  const resolve = (node: FilterInputNode): FilterInputNode => {
    if ('filters' in node) {
      return { ...node, filters: node.filters.map(resolve) };
    }
    // An update may leave the field unchanged.
    if (!node.field_id) return node;

    const column = resolveFieldRef(context, columns, node.field_id);
    return { ...node, field_id: column.id };
  };

  return resolve(filter);
}
