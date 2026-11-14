import { isDateType } from 'nocodb-sdk';
import type { FilterType, NcContext, UITypes } from 'nocodb-sdk';
import type Filter from '~/models/Filter';
import { FieldHandler } from '~/db/field-handler';
import { Column, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

/**
 * Run the read path's filter verification at write time. A stored condition
 * the read path refuses (unknown field, `btw` on a Date field) makes every
 * later read of the view or table fail.
 */
export async function assertFiltersReadable(
  context: NcContext,
  tableId: string,
  filters: Partial<FilterType>[],
): Promise<void> {
  if (!filters?.length) return;

  const model = await Model.get(context, tableId);
  if (!model) NcError.get(context).tableNotFound(tableId);

  const source = await Source.get(context, model.source_id);
  const baseModel = await Model.getBaseModelSQL(context, {
    id: model.id,
    dbDriver: await NcConnectionMgrv2.get(source),
    source,
  });

  await FieldHandler.fromBaseModel(baseModel).verifyFilters(
    filters as Filter[],
  );
}

/**
 * Write-time check for a date condition saved through the console's filter
 * endpoints: its sub-op and value go through the same verification as a read.
 * Leaves without a field or operator are still being filled in and pass.
 */
export async function assertDateFiltersReadable(
  context: NcContext,
  filters: Partial<FilterType>[],
): Promise<void> {
  // Filter.insert saves a group's children too
  const leaves: Partial<FilterType>[] = [];
  const collect = (nodes: Partial<FilterType>[] = []) => {
    for (const node of nodes) {
      if (!node) continue;
      if (node.is_group) collect(node.children);
      else leaves.push(node);
    }
  };
  collect(filters);

  const byTable = new Map<string, Partial<FilterType>[]>();
  for (const filter of leaves) {
    if (!filter.fk_column_id || !filter.comparison_op) continue;

    const column = await Column.get(context, { colId: filter.fk_column_id });
    if (!column) continue;
    if (!filter.comparison_sub_op && !isDateType(column.uidt as UITypes)) {
      continue;
    }

    const tableLeaves = byTable.get(column.fk_model_id) ?? [];
    tableLeaves.push(filter);
    byTable.set(column.fk_model_id, tableLeaves);
  }

  for (const [tableId, tableLeaves] of byTable) {
    await assertFiltersReadable(context, tableId, tableLeaves);
  }
}
