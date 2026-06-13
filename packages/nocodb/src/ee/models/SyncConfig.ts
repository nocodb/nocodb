import { CronExpressionParser } from 'cron-parser';
import {
  type MetaType,
  type NcContext,
  type OnDeleteAction,
  type SyncCategory,
  type SyncMappingType,
  SyncTrigger,
  type SyncType,
} from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';
import { Integration, SyncMapping } from '~/models';
import { NcError } from '~/helpers/ncError';

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
  sync_trigger_cron?: string;
  sync_trigger_secret: string | null;
  sync_job_id: string;

  last_sync_at: string | null;
  next_sync_at: string | null;

  on_delete_action: OnDeleteAction;

  deleted?: boolean;

  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;

  children?: SyncConfig[];

  /** Table mappings of the (root) sync config — populated by `listSync`. */
  mappings?: SyncMappingType[];

  meta?: MetaType;

  constructor(syncConfig: Partial<SyncConfig>) {
    Object.assign(this, syncConfig);
  }

  /**
   * Load and attach this sync config's table mappings. Mappings are always
   * recorded against the ROOT sync config, so child configs resolve through
   * their parent. The frontend relies on `mappings` to resolve a synced
   * table back to its owning sync config (e.g. sidebar context-menu
   * shortcuts) — attach them on the responses that get cached there.
   */
  public async getMappings(
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ): Promise<SyncMappingType[]> {
    this.mappings = await SyncMapping.list(
      context,
      {
        fk_sync_config_id: this.fk_parent_sync_config_id || this.id,
      },
      ncMeta,
    );

    return this.mappings;
  }

  /**
   * `get` plus its table mappings — for the few response paths the frontend
   * reads `mappings` off (readSync / createSync / updateSync). Kept separate
   * from `get` so the hot paths (processor, triggerSync, detach guards) don't
   * pay for an extra uncached `SyncMapping.list` query they never read.
   */
  public static async getWithMappings(
    context: NcContext,
    id: string,
    includeDeleted = false,
    ncMeta = Noco.ncMeta,
  ) {
    const syncConfig = await this.get(context, id, includeDeleted, ncMeta);
    if (syncConfig) await syncConfig.getMappings(context, ncMeta);
    return syncConfig;
  }

  public static async get(
    context: NcContext,
    id: string,
    includeDeleted = false,
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.SYNC_CONFIGS}:${id}`;
    let syncConfig = await NocoCache.get(
      context,
      key,
      CacheGetType.TYPE_OBJECT,
    );

    if (!syncConfig) {
      syncConfig = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.SYNC_CONFIGS,
        id,
      );

      if (!syncConfig) return null;

      await NocoCache.set(
        context,
        key,
        prepareForResponse(syncConfig, ['config', 'meta']),
      );
    }

    if (syncConfig.deleted && !includeDeleted) return null;

    // A child whose parent is soft-deleted is part of a trashed tree — treat it
    // as not-found too (mirrors `list`, which drops children of a filtered-out
    // parent). Only surfaced when includeDeleted is explicitly set.
    if (syncConfig.fk_parent_sync_config_id && !includeDeleted) {
      const parent = await this.get(
        context,
        syncConfig.fk_parent_sync_config_id,
        false,
        ncMeta,
      );
      if (!parent) return null;
    }

    if (!syncConfig.fk_parent_sync_config_id) {
      syncConfig = new SyncConfig(syncConfig);

      syncConfig.children = await syncConfig.listChildren(
        context,
        { includeDeleted },
        ncMeta,
      );
    }

    return new SyncConfig(syncConfig);
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
      'created_by',
      'updated_by',
      'meta',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_CONFIGS,
      prepareForDb(insertObj, ['config', 'meta']),
    );

    return this.get(context, id, false, ncMeta);
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
      'updated_by',
      'meta',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_CONFIGS,
      prepareForDb(updateObj, ['config', 'meta']),
      id,
    );

    await NocoCache.update(
      context,
      `${CacheScope.SYNC_CONFIGS}:${id}`,
      prepareForResponse(updateObj, ['config', 'meta']),
    );

    return this.get(context, id, false, ncMeta);
  }

  public static async delete(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const syncConfig = await this.get(context, id, true, ncMeta);

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
      const children = await syncConfig.listChildren(context, {}, ncMeta);

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
    await NocoCache.del(context, key);

    return true;
  }

  /**
   * Soft-delete (trash) or restore a single sync config row by flipping the
   * `deleted` flag. Single-row only — parent/child cascade is orchestrated by
   * the trash handler so it can record what was trashed for a faithful restore.
   */
  public static async softDelete(
    context: NcContext,
    id: string,
    deleted = true,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_CONFIGS,
      { deleted },
      id,
    );

    await NocoCache.update(context, `${CacheScope.SYNC_CONFIGS}:${id}`, {
      deleted,
    });

    return true;
  }

  static async list(
    context: NcContext,
    { includeDeleted = false }: { includeDeleted?: boolean } = {},
    ncMeta = Noco.ncMeta,
  ) {
    if (!context.base_id || !context.workspace_id) {
      return [];
    }

    const syncConfigs = (
      await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.SYNC_CONFIGS,
        {},
      )
    ).filter((syncConfig) => includeDeleted || !syncConfig.deleted);

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

    const result = rootSyncConfigs.map((syncConfig) => {
      return new SyncConfig(prepareForResponse(syncConfig, ['config', 'meta']));
    });

    // Attach mappings for every root config in ONE query (mappings are always
    // recorded against the root) instead of an N+1 over `getMappings`.
    if (result.length) {
      const allMappings = await SyncMapping.listByConfigIds(
        context,
        result.map((syncConfig) => syncConfig.id),
        ncMeta,
      );
      const byConfigId = new Map<string, SyncMappingType[]>();
      for (const mapping of allMappings) {
        const list = byConfigId.get(mapping.fk_sync_config_id) ?? [];
        list.push(mapping);
        byConfigId.set(mapping.fk_sync_config_id, list);
      }
      for (const syncConfig of result) {
        syncConfig.mappings = byConfigId.get(syncConfig.id) ?? [];
      }
    }

    return result;
  }

  async listChildren(
    context: NcContext,
    { includeDeleted = false }: { includeDeleted?: boolean } = {},
    ncMeta = Noco.ncMeta,
  ) {
    if (this.fk_parent_sync_config_id) {
      NcError.get(context).badRequest('This is a child sync config');
    }

    const syncConfigs = (
      await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.SYNC_CONFIGS,
        {
          condition: {
            fk_parent_sync_config_id: this.id,
          },
        },
      )
    ).filter((syncConfig) => includeDeleted || !syncConfig.deleted);

    return syncConfigs.map((syncConfig) => {
      return new SyncConfig(prepareForResponse(syncConfig, ['config', 'meta']));
    });
  }

  static async calculateNextSyncAt(
    context: NcContext,
    syncConfigId: string,
    from?: Date,
    ncMeta = Noco.ncMeta,
  ) {
    const syncConfig = await this.get(context, syncConfigId, false, ncMeta);

    if (!syncConfig) {
      return null;
    }

    if (syncConfig.sync_trigger === SyncTrigger.Schedule) {
      try {
        const cron = CronExpressionParser.parse(syncConfig.sync_trigger_cron, {
          currentDate: from,
          tz: 'UTC',
        });

        let nextSyncAt = cron.next().toISOString();

        // if less than 50 mins (10 min tolerance), set to 1 hour from now
        if (new Date(nextSyncAt).getTime() - Date.now() < 60 * 50 * 1000) {
          const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
          nextSyncAt = oneHourFromNow.toISOString();
        }

        return nextSyncAt;
      } catch (e) {
        return null;
      }
    } else {
      return null;
    }
  }
}
