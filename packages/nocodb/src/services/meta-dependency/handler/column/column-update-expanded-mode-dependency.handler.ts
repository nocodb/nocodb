import { Injectable } from '@nestjs/common';
import { MetaEventType, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { View } from '~/models';
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

    await View.updateIfColumnUsedAsExpandedMode(
      context,
      oldCol.id,
      oldCol.fk_model_id,
      ncMeta,
    );
  }
}
