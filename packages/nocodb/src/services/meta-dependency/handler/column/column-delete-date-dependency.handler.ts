import { Injectable } from '@nestjs/common';
import { MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '../../types';
import { DateDependency } from '~/models';
import Noco from '~/Noco';

/**
 * @class ColumnDeleteDateDependencyHandler
 * @description When a column is deleted, nullifies any date dependency field
 * references that point to it. If the deleted column was a required field
 * (start or end date), the rule is deactivated.
 */
@Injectable()
export class ColumnDeleteDateDependencyHandler implements MetaEventHandler {
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const columnId = param.oldEntity?.id;
    if (!columnId) return undefined;

    const isUsed = await DateDependency.isColumnUsed(
      context,
      columnId,
      ncMeta as any,
    );

    if (isUsed) {
      return { columns: [param.oldEntity] };
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
    const columnId = param.oldEntity?.id;
    if (!columnId) return;

    await DateDependency.clearColumnRef(context, columnId, ncMeta as any);
  }
}
