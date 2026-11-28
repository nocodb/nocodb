import { Injectable } from '@nestjs/common';
import { MetaEventType, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import {
  clearDownstreamTooLongErrors,
  hasTooLongFormulaErrors,
} from '~/services/meta-dependency/dependent-error-helpers';
import Noco from '~/Noco';

const EXPANDED_UIDTS = new Set<string>([
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.Formula,
]);

/**
 * A formula's SQL inlines the formulas, lookups and rollups it reads, so
 * editing one of them can bring a stored too-long error back under the cap.
 */
@Injectable()
export class ColumnUpdateTooLongRepairDependencyHandler
  implements MetaEventHandler
{
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const col = param.newEntity;
    // A type change away from formula/lookup/rollup shrinks its readers' SQL too.
    const expanded =
      EXPANDED_UIDTS.has(col?.uidt) ||
      EXPANDED_UIDTS.has(param.oldEntity?.uidt);
    if (!col?.id || !expanded) return undefined;
    return (await hasTooLongFormulaErrors(context, ncMeta)) ? {} : undefined;
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await clearDownstreamTooLongErrors(
      context,
      { id: param.newEntity.id },
      ncMeta,
    );
  }
}
