import { CronExpressionParser } from 'cron-parser';
import {
  type NcContext,
  type OnDeleteAction,
  type SyncCategory,
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

  title: string;

  fk_workspace_id: string;
  base_id: string;

  fk_parent_sync_config_id: string | null;

  fk_integration_id: string;

  sync_category: SyncCategory;
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

  children?: SyncConfig[];

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

    if (!syncConfig.fk_parent_sync_config_id) {
      syncConfig = new SyncConfig(syncConfig);

      const children = await syncConfig.listChildren(context, ncMeta);

      syncConfig.children = children;
    }

    return syncConfig;
  }

  public static async insert(
    context: NcContext,
    syncConfig: Partial<SyncConfig>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj: Record<string, any> = extractProps(syncConfig, [
      'title',
      'fk_integration_id',
      'fk_parent_sync_config_id',
      'sync_category',
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
      'title',
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

    // delete all children first
    if (!syncConfig.fk_parent_sync_config_id) {
      const children = await syncConfig.listChildren(context, ncMeta);

      for (const child of children) {
        await SyncConfig.delete(context, child.id, ncMeta);
      }
    }

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

    const parentChildMap = new Map();

    // Group syncConfigs by their parent ID
    syncConfigs.forEach((syncConfig) => {
      const parentId = syncConfig.fk_parent_sync_config_id;
      if (parentId) {
        if (!parentChildMap.has(parentId)) {
          parentChildMap.set(parentId, []);
        }
        parentChildMap.get(parentId).push(syncConfig);
      }
    });

    // Attach children to their respective parent syncConfig
    syncConfigs.forEach((syncConfig) => {
      if (parentChildMap.has(syncConfig.id)) {
        syncConfig.children = parentChildMap.get(syncConfig.id);
      }
    });

    // Filter out only root records (those without a parent)
    const rootSyncConfigs = syncConfigs.filter(
      (syncConfig) => !syncConfig.fk_parent_sync_config_id,
    );

    return rootSyncConfigs.map((syncConfig) => {
      return new SyncConfig(syncConfig);
    });
  }

  async listChildren(context: NcContext, ncMeta = Noco.ncMeta) {
    if (this.fk_parent_sync_config_id) {
      throw new Error('This is a child sync config');
    }

    const syncConfigs = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_CONFIGS,
      {
        condition: {
          fk_parent_sync_config_id: this.id,
        },
      },
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
