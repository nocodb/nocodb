import { Injectable } from '@nestjs/common';
import { MetaEventType, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { GalleryView, KanbanView } from '~/models';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

/**
 * When an Attachment column changes type to anything else, Gallery / Kanban
 * views that pinned it as their cover image now point at an invalid column —
 * null those FKs out so the views fall back to the "select cover image"
 * prompt instead of rendering against a non-attachment column. Sorts and
 * filters on the same column are intentionally left alone — they may still
 * be valid against the new type.
 */
@Injectable()
export class ColumnUpdateCoverImageDependencyHandler
  implements MetaEventHandler
{
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];

  async getAffectedDependency(
    _context: NcContext,
    param: MetaDependencyEventRequest,
    _ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const oldCol = param.oldEntity;
    const newCol = param.newEntity;
    if (!oldCol?.id || !newCol?.id) return undefined;

    // Only fires when the type changes away from Attachment.
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
    const columnId = param.oldEntity?.id;
    if (!columnId) return;

    for (const v of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.GALLERY_VIEW,
      { condition: { fk_cover_image_col_id: columnId } },
    )) {
      await GalleryView.update(
        context,
        v.fk_view_id,
        { fk_cover_image_col_id: null },
        ncMeta,
      );
    }

    for (const v of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      { condition: { fk_cover_image_col_id: columnId } },
    )) {
      await KanbanView.update(
        context,
        v.fk_view_id,
        { fk_cover_image_col_id: null },
        ncMeta,
      );
    }
  }
}
