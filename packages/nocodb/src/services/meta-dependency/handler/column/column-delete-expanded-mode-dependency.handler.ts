import { Injectable } from '@nestjs/common';
import { MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { View } from '~/models';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

/**
 * Reset `attachment_mode_column_id` on any view that pinned the deleted
 * column for expanded-form mode. View falls back to field mode.
 */
@Injectable()
export class ColumnDeleteExpandedModeDependencyHandler
  implements MetaEventHandler
{
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
    await View.updateIfColumnUsedAsExpandedMode(
      context,
      oldCol.id,
      oldCol.fk_model_id,
      ncMeta,
    );
  }
}
