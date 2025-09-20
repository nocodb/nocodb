import dayjs from 'dayjs';
import type { PlanLimitTypes } from 'nocodb-sdk';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { Workspace } from '~/models';

export function getPeriodStartFromAnchor(anchor: string): string {
  const anchorDate = dayjs(anchor);
  const today = dayjs().utc();

  const monthsSinceAnchor = today.diff(anchorDate, 'month');
  let periodStart = anchorDate.add(monthsSinceAnchor, 'month');

  if (today.isBefore(periodStart)) {
    periodStart = anchorDate.add(monthsSinceAnchor - 1, 'month');
  }

  return periodStart.format('YYYY-MM-DD');
}

async function resolveAnchor(workspaceId: string, ncMeta = Noco.ncMeta) {
  const workspace = await Workspace.get(workspaceId, undefined, ncMeta, false);
  return (
    workspace?.payment?.subscription?.billing_cycle_anchor ??
    workspace?.created_at
  );
}

export default class UsageStat {
  fk_workspace_id: string;
  usage_type: PlanLimitTypes;
  period_start: string;
  count: number;

  created_at: string;
  updated_at: string;

  constructor(usageStat: Partial<UsageStat>) {
    Object.assign(this, usageStat);
  }

  public static async get(
    fk_workspace_id: string,
    usage_type: string,
    period_start: string,
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.USAGE_STATS}:${fk_workspace_id}:${usage_type}:${period_start}`;
    let usageStat = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);
    if (!usageStat) {
      usageStat = await ncMeta.metaGet2(
        fk_workspace_id,
        RootScopes.WORKSPACE,
        MetaTable.USAGE_STATS,
        {
          fk_workspace_id,
          usage_type,
          period_start,
        },
      );
      await NocoCache.set('root', key, usageStat);
    }

    return usageStat && new UsageStat(usageStat);
  }

  public static async getPeriodStats(
    fk_workspace_id: string,
    anchor?: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Record<PlanLimitTypes, number>> {
    if (!anchor) {
      anchor = await resolveAnchor(fk_workspace_id, ncMeta);
    }

    const period_start = getPeriodStartFromAnchor(anchor);
    const key = `${CacheScope.USAGE_STATS}:${fk_workspace_id}:${period_start}`;
    let usageStats = await NocoCache.getHash('root', key);
    if (!usageStats) {
      const usageStatsList = await ncMeta.metaList2(
        fk_workspace_id,
        RootScopes.WORKSPACE,
        MetaTable.USAGE_STATS,
        {
          condition: {
            fk_workspace_id,
            period_start,
          },
        },
      );

      // convert to object
      usageStats = {};
      for (const usageStat of usageStatsList) {
        usageStats[usageStat.usage_type] = +usageStat.count;
      }

      await NocoCache.setHash('root', key, usageStats, {
        ttl: 40 * 24 * 60 * 60, // 40 days
      });
    }

    // cast to number
    return Object.entries(usageStats).reduce((acc, [key, value]) => {
      acc[key as PlanLimitTypes] = Number(value);
      return acc;
    }, {} as Record<PlanLimitTypes, number>);
  }

  public static async dbUpsert(
    fk_workspace_id: string,
    usage_type: PlanLimitTypes,
    period_start: string,
    count: number,
    ncMeta = Noco.ncMeta,
  ) {
    const usageStat = await this.get(
      fk_workspace_id,
      usage_type,
      period_start,
      ncMeta,
    );

    // if no change in count, return
    if (usageStat && usageStat.count === count) {
      return;
    }

    const cacheKey = `${CacheScope.USAGE_STATS}:${fk_workspace_id}:${usage_type}:${period_start}`;

    if (usageStat) {
      const updateObj = {
        count,
      };

      await ncMeta.metaUpdate(
        fk_workspace_id,
        RootScopes.WORKSPACE,
        MetaTable.USAGE_STATS,
        updateObj,
        {
          fk_workspace_id,
          usage_type,
          period_start: usageStat.period_start,
        },
      );

      await NocoCache.update('root', cacheKey, updateObj);

      await NocoCache.setHashField(
        'root',
        `${CacheScope.USAGE_STATS}:${fk_workspace_id}:${usageStat.period_start}`,
        usage_type,
        updateObj.count,
      );
    } else {
      const insertObj = {
        fk_workspace_id,
        usage_type,
        period_start,
        count,
      };

      await ncMeta.metaInsert2(
        fk_workspace_id,
        RootScopes.WORKSPACE,
        MetaTable.USAGE_STATS,
        insertObj,
        true,
      );

      await NocoCache.set('root', cacheKey, insertObj);

      await NocoCache.setHashField(
        'root',
        `${CacheScope.USAGE_STATS}:${fk_workspace_id}:${period_start}`,
        usage_type,
        insertObj.count,
      );
    }
  }

  public static async incrby(
    fk_workspace_id: string,
    usage_type: PlanLimitTypes,
    count: number,
    anchor?: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (!anchor) {
      anchor = await resolveAnchor(fk_workspace_id, ncMeta);
    }

    const period_start = getPeriodStartFromAnchor(anchor);

    const key = `${CacheScope.USAGE_STATS}:${fk_workspace_id}:${period_start}`;

    // make sure the key is set in cache
    await this.getPeriodStats(fk_workspace_id, anchor, ncMeta);

    await NocoCache.incrHashField('root', key, usage_type, count);

    await NocoCache.set('root', `${CacheScope.USAGE_STATS}:workspaces`, [key]);
  }
}
