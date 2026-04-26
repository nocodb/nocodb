import { Injectable } from '@nestjs/common';
import { MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { CalendarRange } from '~/models';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

/**
 * Drop every CalendarRange row that referenced the deleted column as either
 * the `from` or `to` boundary. Calendar UI shows its "configure range"
 * prompt when the view loses its range.
 */
@Injectable()
export class ColumnDeleteCalendarRangeDependencyHandler
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

    for (const fkField of ['fk_from_column_id', 'fk_to_column_id']) {
      const rows = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW_RANGE,
        { condition: { [fkField]: id }, limit: 1 },
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

    for (const range of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      {
        xcCondition: {
          _or: [
            { fk_from_column_id: { eq: id } },
            { fk_to_column_id: { eq: id } },
          ],
        },
      },
    )) {
      await CalendarRange.delete(range.id, context, ncMeta);
    }
  }
}
