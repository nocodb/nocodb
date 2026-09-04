import { Injectable } from '@nestjs/common';
import { DependencyTableType, MetaEventType } from 'nocodb-sdk';
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
 *
 * Trashing a field is a *soft* delete (`nc_columns.deleted = true`, set before
 * this event fires) and is undoable, so the rows are kept: the read path
 * already skips ids that no longer resolve, so the column reads NULL for that
 * field while it sits in the trash and starts tracking it again on restore.
 * Dropping them here would make restore silently lose the tracking.
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
    if (await this.isSoftDelete(context, id, ncMeta)) return undefined;

    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DEPENDENCY_TRACKER,
      {
        condition: {
          source_type: DependencyTableType.Column,
          dependent_type: DependencyTableType.Column,
          source_id: id,
        },
        limit: 1,
      },
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
    if (await this.isSoftDelete(context, id, ncMeta)) return;
    await LmtTrackedField.deleteByTrackedColumnId(context, id, ncMeta);
  }

  /** The column row survives a trash with `deleted = true`; a real delete removes it. */
  private async isSoftDelete(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const row = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      { id: columnId },
    );
    return !!row?.deleted;
  }
}
