import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { type Column, View } from '~/models';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';
import { ViewRowColorService } from '~/services/view-row-color.service';

/**
 * Sweep row-coloring rules that referenced the deleted column:
 *  - SingleSelect-mode views pinned to this col → drop row coloring info
 *  - cell-target conditions on this col → delete; if it was the last
 *    condition for the view, strip row-coloring mode entirely
 *  - filter conditions referencing this col inside row-color rules → delete
 *    the rule when no other filter remains
 *
 * Implementation lives in `ViewRowColorService.checkIfColumnInvolved`; the
 * handler just dispatches with `action: 'delete'`.
 */
@Injectable()
export class ColumnDeleteRowColorDependencyHandler implements MetaEventHandler {
  private readonly logger = new Logger(
    ColumnDeleteRowColorDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  constructor(private readonly viewRowColorService: ViewRowColorService) {}

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const id = param.oldEntity?.id;
    if (!id) return undefined;

    // Cell-target conditions on this column.
    const cellTargets = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      { condition: { fk_target_column_id: id }, limit: 1 },
    );
    if (cellTargets.length) return {};

    // Filter conditions inside row-coloring rules referencing this column.
    const innerFilters = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      {
        xcCondition: (qb: any) => {
          qb.where('fk_column_id', id).whereNotNull(
            'fk_row_color_condition_id',
          );
        },
        limit: 1,
      },
    );
    if (innerFilters.length) return {};

    return undefined;
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const oldCol = param.oldEntity as Column;
    if (!oldCol?.id) return;

    // Snapshot affected view IDs before the cleanup so we can broadcast
    // `view_update`. Two probes — cell-target conditions and filter
    // conditions inside row-coloring rules — match the gate above.
    const affectedViewIds = new Set<string>();
    for (const row of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      { condition: { fk_target_column_id: oldCol.id } },
    )) {
      if (row.fk_view_id) affectedViewIds.add(row.fk_view_id);
    }
    for (const row of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      {
        xcCondition: (qb: any) => {
          qb.where('fk_column_id', oldCol.id).whereNotNull(
            'fk_row_color_condition_id',
          );
        },
      },
    )) {
      if (row.fk_view_id) affectedViewIds.add(row.fk_view_id);
    }

    const { applyRowColorInvolvement } =
      await this.viewRowColorService.checkIfColumnInvolved(context, {
        existingColumn: oldCol,
        action: 'delete',
        ncMeta,
      });
    await applyRowColorInvolvement();

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
      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_update',
          payload: { ...view, from_row_color: true },
        },
      });
    }
  }
}
