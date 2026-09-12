import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { View } from '~/models';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';

/**
 * Reset `attachment_mode_column_id` on any view that pinned the deleted
 * column for expanded-form mode. View falls back to field mode.
 */
@Injectable()
export class ColumnDeleteExpandedModeDependencyHandler
  implements MetaEventHandler
{
  private readonly logger = new Logger(
    ColumnDeleteExpandedModeDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const id = param.oldEntity?.id;
    if (!id) return undefined;

    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      { condition: { attachment_mode_column_id: id }, limit: 1 },
    );
    return rows.length ? {} : undefined;
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const oldCol = param.oldEntity;
    if (!oldCol?.id || !oldCol.fk_model_id) return;

    // Snapshot affected view IDs before the update so we can broadcast.
    const affectedViewIds = new Set<string>(
      (
        await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.VIEWS,
          { condition: { attachment_mode_column_id: oldCol.id } },
        )
      ).map((v: any) => v.id),
    );

    await View.updateIfColumnUsedAsExpandedMode(
      context,
      oldCol.id,
      oldCol.fk_model_id,
      ncMeta,
    );

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
        payload: { action: 'view_update', payload: view },
      });
    }
  }
}
