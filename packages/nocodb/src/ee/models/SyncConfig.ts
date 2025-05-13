import { CronExpressionParser } from 'cron-parser';
import {
  type NcContext,
  type OnDeleteAction,
  SyncTrigger,
  type SyncType,
} from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';
import { Integration } from '~/models';

export default class SyncConfig {
  id: string;

  fk_workspace_id: string;
  base_id: string;

  fk_integration_id: string;

  sync_type: SyncType;
  sync_trigger: SyncTrigger;
  sync_trigger_cron: string | null;
  sync_trigger_secret: string | null;
  sync_job_id: string;

  last_sync_at: string | null;
  next_sync_at: string | null;

  on_delete_action: OnDeleteAction;

  created_at: string;
  updated_at: string;

  constructor(syncConfig: Partial<SyncConfig>) {
    Object.assign(this, syncConfig);
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.SYNC_CONFIGS}:${id}`;
    let syncConfig = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

    if (!syncConfig) {
      syncConfig = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.SYNC_CONFIGS,
        {
          id: id,
        },
      );

      if (!syncConfig) return null;

      await NocoCache.set(key, syncConfig);
    }

    return new SyncConfig(syncConfig);
  }

  public static async insert(
    context: NcContext,
    syncConfig: Partial<SyncConfig>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj: Record<string, any> = extractProps(syncConfig, [
      'fk_integration_id',
      'sync_type',
      'sync_trigger',
      'sync_trigger_cron',
      'last_sync_at',
      'next_sync_at',
      'sync_job_id',
      'on_delete_action',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_CONFIGS,
      insertObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
    id: string,
    syncConfig: Partial<SyncConfig>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(syncConfig, [
      'sync_type',
      'sync_trigger',
      'sync_trigger_cron',
      'last_sync_at',
      'next_sync_at',
      'sync_job_id',
      'on_delete_action',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_CONFIGS,
      prepareForDb(updateObj, 'config'),
      id,
    );

    await NocoCache.update(
      `${CacheScope.SYNC_CONFIGS}:${id}`,
      prepareForResponse(updateObj, 'config'),
    );

    return true;
  }

  public static async delete(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const syncConfig = await this.get(context, id, ncMeta);

    if (!syncConfig) {
      return false;
    }

    const integration = await Integration.get(
      context,
      syncConfig.fk_integration_id,
      true,
      ncMeta,
    );

    if (integration) {
      await integration.delete(ncMeta);
    }

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_CONFIGS,
      id,
    );

    const key = `${CacheScope.SYNC_CONFIGS}:${id}`;
    await NocoCache.del(key);

    return true;
  }

  static async list(context: NcContext, ncMeta = Noco.ncMeta) {
    if (!context.base_id || !context.workspace_id) {
      return [];
    }

    const syncConfigs = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_CONFIGS,
      {},
    );

    return syncConfigs.map((syncConfig) => {
      return new SyncConfig(syncConfig);
    });
  }

  static async calculateNextSyncAt(
    context: NcContext,
    syncConfigId: string,
    from?: Date,
    ncMeta = Noco.ncMeta,
  ) {
    const syncConfig = await this.get(context, syncConfigId, ncMeta);

    if (!syncConfig) {
      return null;
    }

    if (syncConfig.sync_trigger === SyncTrigger.Schedule) {
      try {
        const cron = CronExpressionParser.parse(syncConfig.sync_trigger_cron, {
          currentDate: from,
          tz: 'UTC',
        });

        const nextSyncAt = cron.next().toISOString();

        return nextSyncAt;
      } catch (e) {
        return null;
      }
    } else {
      return null;
    }
  }
}
