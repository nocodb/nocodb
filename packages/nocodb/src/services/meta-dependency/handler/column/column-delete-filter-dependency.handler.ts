import { Injectable } from '@nestjs/common';
import { MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { Filter, Sort } from '~/models';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

/**
 * Sort + filter cleanup for a deleted column.
 *
 * Sweeps:
 *  - `nc_sorts` rows where `fk_column_id = colId`
 *  - `nc_filter_exp` rows where `fk_column_id = colId` OR `fk_value_col_id = colId`
 *  - filter-group children parented by this column (recursive cache-aware)
 */
@Injectable()
export class ColumnDeleteFilterDependencyHandler implements MetaEventHandler {
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const id = param.oldEntity?.id;
    if (!id) return undefined;

    for (const table of [MetaTable.SORT, MetaTable.FILTER_EXP]) {
      const rows = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        table,
        { condition: { fk_column_id: id }, limit: 1 },
      );
      if (rows.length) return {};
    }
    return undefined;
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const id = param.oldEntity?.id;
    if (!id) return;

    for (const sort of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      { condition: { fk_column_id: id } },
    )) {
      await Sort.delete(context, sort.id, ncMeta);
    }

    for (const filter of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      {
        xcCondition: {
          _or: [{ fk_column_id: { eq: id } }, { fk_value_col_id: { eq: id } }],
        },
      },
    )) {
      await Filter.delete(context, filter.id, ncMeta);
    }

    await Filter.deleteAllByParentColumn(context, id, ncMeta);
  }
}
