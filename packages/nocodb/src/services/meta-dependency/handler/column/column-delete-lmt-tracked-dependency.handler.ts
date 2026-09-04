import { Injectable } from '@nestjs/common';
import { MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { LmtTrackedField } from '~/models';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

/**
 * LastModifiedTime/LastModifiedBy tracked-field junction cleanup. When a
 * tracked column is deleted its junction rows become orphans — drop them.
 * The LMT/LMB column itself stays (its value degrades gracefully when the
 * tracked set shrinks/empties).
 */
@Injectable()
export class ColumnDeleteLmtTrackedDependencyHandler
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
      MetaTable.COL_LMT_TRACKED_FIELDS,
      { condition: { fk_tracked_column_id: id }, limit: 1 },
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
    const id = param.oldEntity?.id;
    if (!id) return;
    await LmtTrackedField.deleteByTrackedColumnId(context, id, ncMeta);
  }
}
