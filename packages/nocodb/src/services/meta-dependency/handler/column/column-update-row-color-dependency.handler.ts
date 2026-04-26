import { Injectable } from '@nestjs/common';
import { MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import type { Column } from '~/models';
import Noco from '~/Noco';
import { ViewRowColorService } from '~/services/view-row-color.service';

/**
 * Type-change cleanup for row-coloring rules. Mirrors what the column-delete
 * handler does for the `delete` action, but invoked on `COLUMN_UPDATED` with
 * `action: 'update'` so `ViewRowColorService` can decide which subset of
 * rules become invalid (e.g. SingleSelect → non-SingleSelect breaks
 * SELECT-mode row coloring; cell-target / filter-condition rules stay until
 * the column is actually deleted).
 */
@Injectable()
export class ColumnUpdateRowColorDependencyHandler implements MetaEventHandler {
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];

  constructor(private readonly viewRowColorService: ViewRowColorService) {}

  async getAffectedDependency(
    _context: NcContext,
    param: MetaDependencyEventRequest,
    _ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const oldCol = param.oldEntity;
    const newCol = param.newEntity;
    if (!oldCol?.id || !newCol?.id) return undefined;

    // Only relevant when the column type actually changes — same gate the
    // service-side row-color call used.
    if (oldCol.uidt === newCol.uidt) return undefined;
    return {};
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const oldCol = param.oldEntity as Column;
    const newCol = param.newEntity as Column;
    if (!oldCol?.id || !newCol?.id) return;

    const { applyRowColorInvolvement } =
      await this.viewRowColorService.checkIfColumnInvolved({
        context,
        existingColumn: oldCol,
        newColumn: newCol,
        action: 'update',
        ncMeta,
      });
    await applyRowColorInvolvement();
  }
}
