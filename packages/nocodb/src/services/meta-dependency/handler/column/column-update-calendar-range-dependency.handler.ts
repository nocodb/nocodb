import { Injectable } from '@nestjs/common';
import { MetaEventType, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { CalendarRange, Column } from '~/models';
import Noco from '~/Noco';

const DATE_TIME_TYPES: UITypes[] = [
  UITypes.Date,
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
];

/**
 * Calendar range cleanup on column-type / timezone change. Two cases:
 *
 *  1. Was a date-family type, now isn't → drop every range that referenced
 *     the column (the calendar UI shows its "configure range" prompt).
 *  2. Still a date-family type → re-evaluate each range and drop any whose
 *     paired column has a different uidt or a mismatched timezone.
 *
 * Mirrors the inline logic that used to live in `columns.service.columnUpdate`.
 */
@Injectable()
export class ColumnUpdateCalendarRangeDependencyHandler
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

    const wasDate = DATE_TIME_TYPES.includes(oldCol.uidt as UITypes);
    const isDate = DATE_TIME_TYPES.includes(newCol.uidt as UITypes);
    const tzChanged = oldCol.meta?.timezone !== newCol.meta?.timezone;

    // Either left the date family, or stayed in it but with a possibly
    // incompatible neighbour.
    if (!wasDate && !isDate) return undefined;
    if (!isDate || (isDate && (oldCol.uidt !== newCol.uidt || tzChanged))) {
      return {};
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
    const oldCol = param.oldEntity as Column;
    const newCol = param.newEntity as Column;
    if (!oldCol?.id || !newCol?.id) return;

    const wasDate = DATE_TIME_TYPES.includes(oldCol.uidt as UITypes);
    const isDate = DATE_TIME_TYPES.includes(newCol.uidt as UITypes);

    if (wasDate && !isDate) {
      // Type left the date family entirely — drop every range pinned to this col.
      const ranges = await CalendarRange.IsColumnBeingUsedAsRange(
        context,
        oldCol.id,
        ncMeta,
      );
      for (const range of ranges ?? []) {
        await CalendarRange.delete(range.id, context, ncMeta);
      }
      return;
    }

    if (!isDate) return;

    // Still a date-family type — drop ranges whose partner column has a
    // different uidt or a mismatched timezone.
    const ranges = await CalendarRange.IsColumnBeingUsedAsRange(
      context,
      oldCol.id,
      ncMeta,
    );
    const newTimezone = newCol.meta?.timezone;

    for (const range of ranges ?? []) {
      let shouldDelete = false;

      const partnerColId =
        range.fk_from_column_id === oldCol.id
          ? range.fk_to_column_id
          : range.fk_to_column_id === oldCol.id
          ? range.fk_from_column_id
          : null;

      if (!partnerColId) {
        if (shouldDelete) await CalendarRange.delete(range.id, context, ncMeta);
        continue;
      }

      const partner = await Column.get(
        context,
        { colId: partnerColId },
        ncMeta,
      );

      if (!partner || partner.uidt !== newCol.uidt) {
        shouldDelete = true;
      } else {
        const partnerTimezone = partner.meta?.timezone;
        if (newTimezone && partnerTimezone && newTimezone !== partnerTimezone) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) await CalendarRange.delete(range.id, context, ncMeta);
    }
  }
}
