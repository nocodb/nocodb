import type { FilterType, NcContext } from 'nocodb-sdk';
import type Filter from '~/models/Filter';
import { FieldHandler } from '~/db/field-handler';
import { Model, Source } from '~/models';
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
