import { type NcContext } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';

export default class SyncMapping {
  id: string;

  fk_workspace_id: string;
  base_id: string;

  fk_sync_config_id: string;
  target_table: string;
  fk_model_id: string;

  created_at: string;
  updated_at: string;

  constructor(syncMapping: Partial<SyncMapping>) {
    Object.assign(this, syncMapping);
  }

  public static async get(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.SYNC_MAPPINGS}:${id}`;
    let syncMapping = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

    if (!syncMapping) {
      syncMapping = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.SYNC_MAPPINGS,
        {
          id: id,
        },
      );

      if (!syncMapping) return null;

      await NocoCache.set(key, syncMapping);
    }

    return new SyncMapping(syncMapping);
  }

  public static async insert(
    context: NcContext,
    syncMapping: Partial<SyncMapping>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj: Record<string, any> = extractProps(syncMapping, [
      'fk_sync_config_id',
      'target_table',
      'fk_model_id',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_MAPPINGS,
      insertObj,
    );

    return this.get(context, id, ncMeta);
  }

  public static async update(
    context: NcContext,
    id: string,
    syncMapping: Partial<SyncMapping>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(syncMapping, [
      'target_table',
      'fk_model_id',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_MAPPINGS,
      prepareForDb(updateObj),
      id,
    );

    await NocoCache.update(
      `${CacheScope.SYNC_MAPPINGS}:${id}`,
      prepareForResponse(updateObj),
    );

    return true;
  }

  public static async delete(
    context: NcContext,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_MAPPINGS,
      id,
    );

    const key = `${CacheScope.SYNC_MAPPINGS}:${id}`;
    await NocoCache.del(key);

    return true;
  }

  static async list(
    context: NcContext,
    param: { fk_sync_config_id: string; force?: boolean },
    ncMeta = Noco.ncMeta,
  ) {
    const syncMappings = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SYNC_MAPPINGS,
      {
        condition: { fk_sync_config_id: param.fk_sync_config_id },
      },
    );

    return syncMappings
      .filter((syncMapping) => {
        if (param.force) return true;
        return syncMapping.target_table !== null;
      })
      .map((syncMapping) => {
        return new SyncMapping(syncMapping);
      });
  }
}
