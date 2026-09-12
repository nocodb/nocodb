import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType, UITypes } from 'nocodb-sdk';
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
 * When an Attachment column changes type to anything else, any view that
 * pinned it as the expanded-form mode column has a dangling
 * `attachment_mode_column_id`. Reset that FK so the expanded form falls back
 * to field mode.
 */
@Injectable()
export class ColumnUpdateExpandedModeDependencyHandler
  implements MetaEventHandler
{
  private readonly logger = new Logger(
    ColumnUpdateExpandedModeDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];

  async getAffectedDependency(
    _context: NcContext,
    param: MetaDependencyEventRequest,
    _ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const oldCol = param.oldEntity;
    const newCol = param.newEntity;
    if (!oldCol?.id || !newCol?.id) return undefined;

    if (oldCol.uidt !== UITypes.Attachment) return undefined;
    if (newCol.uidt === UITypes.Attachment) return undefined;

    return {};
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
