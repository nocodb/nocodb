import { Injectable } from '@nestjs/common';
import { MetaEventType, parseProp, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '../../types';
import type { Filter } from '~/models';
import { MetaTable } from '~/cli';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';
import { CacheDelDirection, CacheScope } from '~/utils/globals';
import Noco from '~/Noco';

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
    if (
      [UITypes.DateTime, UITypes.Date].includes(param.newEntity.uidt) &&
      parseProp(param.newEntity.meta).timezone
    ) {
      validForProcess = true;
      affectedColumnIds.push(param.newEntity.id);
    } else if (
      [UITypes.Formula].includes(param.newEntity.uidt) &&
      parseProp(param.newEntity.meta).display_column_meta?.timezone
    ) {
      validForProcess = true;
      affectedColumnIds.push(param.newEntity.id);
    }
    // TODO: get all lookup associated with column

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
      await ncMeta.metaUpdate(
        each.fk_workspace_id,
        each.base_id,
        MetaTable.FILTER_EXP,
        { meta: stringifyMetaProp(each) },
        each.id,
      );
      ncMeta.knex.attachToTransaction(async () => {
        await NocoCache.deepDel(
          context,
          `${CacheScope.FILTER_EXP}:${each.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      });
    }
  }
}
