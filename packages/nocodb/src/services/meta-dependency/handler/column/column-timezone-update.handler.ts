import { Injectable } from '@nestjs/common';
import { MetaEventType, parseProp, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '../../types';
import { Filter } from '~/models';
import { MetaTable } from '~/cli';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import Noco from '~/Noco';

/**
 * @class ColumnTimezoneUpdateDependencyHandler
 * @description Handles updates to column timezones and propagates these changes to dependent filters.
 * This class is responsible for identifying when a column's timezone changes (for DateTime, Date, or Formula types)
 * and then updating any associated filter expressions that rely on that column's timezone.
 */
@Injectable()
export class ColumnTimezoneUpdateDependencyHandler implements MetaEventHandler {
  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];
  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult> {
    let validForProcess = false;
    const affectedColumnIds: string[] = [];
    const newEntityMeta = parseProp(param.newEntity.meta);
    const oldEntityMeta = parseProp(param.oldEntity.meta);
    if (
      [UITypes.DateTime, UITypes.Date].includes(param.newEntity.uidt) &&
      // we leave it as is if the new meta timezone empty / not set
      newEntityMeta.timezone &&
      newEntityMeta.timezone !== oldEntityMeta.timezone
    ) {
      validForProcess = true;
      affectedColumnIds.push(param.newEntity.id);
    } else if (
      [UITypes.Formula].includes(param.newEntity.uidt) &&
      newEntityMeta.display_column_meta?.timezone &&
      newEntityMeta.display_column_meta?.timezone !==
        oldEntityMeta.display_column_meta?.timezone
    ) {
      validForProcess = true;
      affectedColumnIds.push(param.newEntity.id);
    }

    if (validForProcess) {
      return {
        filters: await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.FILTER_EXP,
          {
            xcCondition: (qb) => qb.whereIn('fk_column_id', affectedColumnIds),
          },
        ),
      };
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
    if (!param.affectedDependencyResult.filters?.length) {
      return;
    }
    let timezone: string;
    if (
      [UITypes.DateTime, UITypes.Date].includes(param.newEntity.uidt) &&
      parseProp(param.newEntity.meta).timezone
    ) {
      timezone = parseProp(param.newEntity.meta).timezone;
    } else if (
      [UITypes.Formula].includes(param.newEntity.uidt) &&
      parseProp(param.newEntity.meta).display_column_meta?.timezone
    ) {
      timezone = parseProp(param.newEntity.meta).display_column_meta?.timezone;
    }
    for (const each of param.affectedDependencyResult.filters as Filter[]) {
      each.meta = parseMetaProp(each);
      each.meta.timezone = timezone;
      await Filter.update(
        {
          ...context,
          base_id: each.base_id,
          workspace_id: each.fk_workspace_id,
        },
        each.id,
        { ...each, meta: stringifyMetaProp(each) },
        ncMeta,
      );
    }
  }
}
