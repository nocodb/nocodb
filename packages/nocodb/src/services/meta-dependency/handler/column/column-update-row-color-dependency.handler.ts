import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  MetaEventType,
  parseProp,
  ROW_COLORING_MODE,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { type Column, View } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';
import { ViewRowColorService } from '~/services/view-row-color.service';

/**
 * Type-change cleanup for row-coloring rules. Mirrors what the column-delete
 * handler does for the `delete` action, but invoked on `COLUMN_UPDATED` with
 * `action: 'update'` so `ViewRowColorService` can decide which subset of
 * rules become invalid (e.g. SingleSelect → non-SingleSelect breaks
 * SELECT-mode row coloring; cell-target / filter-condition rules stay until
 * the column is actually deleted).
 */
@Injectable()
export class ColumnUpdateRowColorDependencyHandler implements MetaEventHandler {
  private readonly logger = new Logger(
    ColumnUpdateRowColorDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];

  constructor(private readonly viewRowColorService: ViewRowColorService) {}

  async getAffectedDependency(
    _context: NcContext,
    param: MetaDependencyEventRequest,
    _ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const oldCol = param.oldEntity;
    const newCol = param.newEntity;
    if (!oldCol?.id || !newCol?.id) return undefined;

    // Only relevant when the column type actually changes — same gate the
    // service-side row-color call used.
    if (oldCol.uidt === newCol.uidt) return undefined;
    return {};
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const oldCol = param.oldEntity as Column;
    const newCol = param.newEntity as Column;
    if (!oldCol?.id || !newCol?.id) return;

    // Snapshot affected view IDs to broadcast after cleanup. Update-time
    // invalidation matches the service: SingleSelect → non-SingleSelect on a
    // column pinned to a SELECT-mode view's row-color config.
    const affectedViewIds = new Set<string>();
    if (
      oldCol.uidt === UITypes.SingleSelect &&
      newCol.uidt !== UITypes.SingleSelect &&
      oldCol.fk_model_id
    ) {
      const views = await View.list(context, oldCol.fk_model_id, false, ncMeta);
      for (const v of views ?? []) {
        if (v.row_coloring_mode !== ROW_COLORING_MODE.SELECT) continue;
        const meta = parseProp(v.meta) as
          | { rowColoringInfo?: { fk_column_id?: string } }
          | undefined;
        if (meta?.rowColoringInfo?.fk_column_id === oldCol.id) {
          affectedViewIds.add(v.id);
        }
      }
    }

    const { applyRowColorInvolvement } =
      await this.viewRowColorService.checkIfColumnInvolved(context, {
        existingColumn: oldCol,
        newColumn: newCol,
        action: 'update',
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
