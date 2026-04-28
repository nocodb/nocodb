import { Injectable } from '@nestjs/common';
import { MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { KanbanView } from '~/models';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

/**
 * Null `fk_grp_col_id` on every Kanban view that pinned the deleted column as
 * its stack-by field. UI prompts to re-select.
 */
@Injectable()
export class ColumnDeleteKanbanGroupByDependencyHandler
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
      MetaTable.KANBAN_VIEW,
      { condition: { fk_grp_col_id: id }, limit: 1 },
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

    for (const v of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      { condition: { fk_grp_col_id: id } },
    )) {
      await KanbanView.update(
        context,
        v.fk_view_id,
        { fk_grp_col_id: null },
        ncMeta,
      );
    }
  }
}
