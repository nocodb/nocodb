import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { GalleryView, KanbanView, View } from '~/models';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';

/**
 * Null `fk_cover_image_col_id` on every Gallery / Kanban view that pinned the
 * deleted column as the cover image. The view stays valid — UI prompts to
 * re-select a cover.
 */
@Injectable()
export class ColumnDeleteCoverImageDependencyHandler
  implements MetaEventHandler
{
  private readonly logger = new Logger(
    ColumnDeleteCoverImageDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const id = param.oldEntity?.id;
    if (!id) return undefined;

    for (const table of [MetaTable.GALLERY_VIEW, MetaTable.KANBAN_VIEW]) {
      const rows = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        table,
        { condition: { fk_cover_image_col_id: id }, limit: 1 },
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

    for (const v of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW,
      { condition: { fk_cover_image_col_id: id } },
    )) {
      await GalleryView.update(
        context,
        v.fk_view_id,
        { fk_cover_image_col_id: null },
        ncMeta,
      );
      affectedViewIds.add(v.fk_view_id);
    }

    for (const v of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      { condition: { fk_cover_image_col_id: id } },
    )) {
      await KanbanView.update(
        context,
        v.fk_view_id,
        { fk_cover_image_col_id: null },
        ncMeta,
      );
      affectedViewIds.add(v.fk_view_id);
    }

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
