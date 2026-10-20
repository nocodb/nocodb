import { Injectable } from '@nestjs/common';
import { MetaEventType, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { clearDownstreamErrors } from '~/services/meta-dependency/dependent-error-helpers';
import Noco from '~/Noco';

const REPAIRABLE_UIDTS = new Set<string>([
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.Formula,
]);

/**
 * @class ColumnUpdateErrorRepairDependencyHandler
 * @description When a lookup/rollup/QR/barcode/formula stops being in error,
 * clear the error on the columns that read it (formulas and URL buttons
 * included), if they validate again. Their error was set when this column
 * broke, and nothing else clears it.
 */
@Injectable()
export class ColumnUpdateErrorRepairDependencyHandler
  implements MetaEventHandler
{
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];

  async getAffectedDependency(
    _context: NcContext,
    param: MetaDependencyEventRequest,
  ): Promise<AffectedDependencyResult | undefined> {
    const oldCol = param.oldEntity;
    const newCol = param.newEntity;
    if (!oldCol?.id || !newCol?.id || oldCol.uidt !== newCol.uidt) {
      return undefined;
    }
    if (!REPAIRABLE_UIDTS.has(newCol.uidt)) return undefined;

    const wasBroken = !!oldCol.colOptions?.error;
    const isBroken = !!newCol.colOptions?.error;
    return wasBroken && !isBroken ? {} : undefined;
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await clearDownstreamErrors(context, { id: param.newEntity.id }, ncMeta);
  }
}
