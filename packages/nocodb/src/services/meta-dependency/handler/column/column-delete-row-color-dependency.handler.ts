import { Injectable } from '@nestjs/common';
import { MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import type { Column } from '~/models';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { ViewRowColorService } from '~/services/view-row-color.service';

/**
 * Sweep row-coloring rules that referenced the deleted column:
 *  - SingleSelect-mode views pinned to this col → drop row coloring info
 *  - cell-target conditions on this col → delete; if it was the last
 *    condition for the view, strip row-coloring mode entirely
 *  - filter conditions referencing this col inside row-color rules → delete
 *    the rule when no other filter remains
 *
 * Implementation lives in `ViewRowColorService.checkIfColumnInvolved`; the
 * handler just dispatches with `action: 'delete'`.
 */
@Injectable()
export class ColumnDeleteRowColorDependencyHandler implements MetaEventHandler {
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  constructor(private readonly viewRowColorService: ViewRowColorService) {}

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const id = param.oldEntity?.id;
    if (!id) return undefined;

    // Cell-target conditions on this column.
    const cellTargets = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      { condition: { fk_target_column_id: id }, limit: 1 },
    );
    if (cellTargets.length) return {};

    // Filter conditions inside row-coloring rules referencing this column.
    const innerFilters = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      {
        xcCondition: (qb: any) => {
          qb.where('fk_column_id', id).whereNotNull(
            'fk_row_color_condition_id',
          );
        },
        limit: 1,
      },
    );
    if (innerFilters.length) return {};

    return undefined;
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const oldCol = param.oldEntity as Column;
    if (!oldCol?.id) return;

    const { applyRowColorInvolvement } =
      await this.viewRowColorService.checkIfColumnInvolved({
        context,
        existingColumn: oldCol,
        action: 'delete',
        ncMeta,
      });
    await applyRowColorInvolvement();
  }
}
