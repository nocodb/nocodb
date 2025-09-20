import { Injectable, Logger } from '@nestjs/common';
import type { PlanLimitTypes } from 'nocodb-sdk';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { UsageStat } from '~/models';

@Injectable()
export class UpdateUsageStatsProcessor {
  private logger = new Logger(UpdateUsageStatsProcessor.name);

  constructor() {}

  async job() {
    const keys = await NocoCache.get(
      'root',
      `${CacheScope.USAGE_STATS}:workspaces`,
      CacheGetType.TYPE_ARRAY,
    );

    await NocoCache.del('root', `${CacheScope.USAGE_STATS}:workspaces`);

    for (const key of keys) {
      const delimiter = `${CacheScope.USAGE_STATS}:`;

      const hash = await NocoCache.getHash('root', key);

      const helpstr = key.slice(key.indexOf(delimiter) + delimiter.length);

      const [fk_workspace_id, period_start] = helpstr.split(':');
      if (!fk_workspace_id || !period_start) {
        this.logger.error(
          `UpdateUsageStatsProcessor: Invalid key ${key} - ${helpstr}`,
        );
        return;
      }

      this.logger.log(`Processing key: ${key}`);

      if (hash) {
        for (const [k, v] of Object.entries(hash)) {
          await UsageStat.dbUpsert(
            fk_workspace_id,
            k as PlanLimitTypes,
            period_start,
            +v,
          );
        }
      }
    }
  }
}
