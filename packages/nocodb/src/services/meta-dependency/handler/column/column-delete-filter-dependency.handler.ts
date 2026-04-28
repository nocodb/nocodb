import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { Filter, Sort, View } from '~/models';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
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
  private readonly logger = new Logger(
    ColumnDeleteFilterDependencyHandler.name,
  );

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

    const affectedViewIds = new Set<string>();

    for (const sort of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      { condition: { fk_column_id: id } },
    )) {
      await Sort.delete(context, sort.id, ncMeta);
      if (sort.fk_view_id) affectedViewIds.add(sort.fk_view_id);
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
      if (filter.fk_view_id) affectedViewIds.add(filter.fk_view_id);
    }

    await Filter.deleteAllByParentColumn(context, id, ncMeta);

    this.broadcastViewUpdates(context, affectedViewIds).catch((e) =>
      this.logger.error(
        `Failed to broadcast view_update events: ${e?.message}`,
        e?.stack,
      ),
    );
  }

  private async broadcastViewUpdates(
    context: NcContext,
    viewIds: Set<string>,
  ): Promise<void> {
    for (const viewId of viewIds) {
      const view = await View.get(context, viewId, false, Noco.ncMeta);
      if (!view) continue;
      await view.getView(context, Noco.ncMeta);
      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: { action: 'view_update', payload: view },
        },
        context.socket_id,
      );
    }
  }
}
