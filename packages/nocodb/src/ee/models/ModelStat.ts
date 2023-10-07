import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

export default class ModelStat {
  fk_workspace_id?: string;
  fk_model_id?: string;
  row_count?: number;

  created_at?: string;
  updated_at?: string;

  constructor(stat: ModelStat) {
    Object.assign(this, stat);
  }

  public static async get(
    workspaceId: string,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let statData = await NocoCache.get(
      `${CacheScope.MODEL_STAT}:${workspaceId}:${modelId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!statData) {
      statData = await ncMeta.metaGet2(null, null, MetaTable.MODEL_STAT, {
        fk_workspace_id: workspaceId,
        fk_model_id: modelId,
      });
      if (statData) {
        await NocoCache.set(
          `${CacheScope.MODEL_STAT}:${workspaceId}:${modelId}`,
          statData,
        );
      }
    }

    return statData && new ModelStat(statData);
  }

  public static async upsert(
    workspaceId: string,
    modelId: string,
    stat: Partial<ModelStat>,
    ncMeta = Noco.ncMeta,
  ) {
    // extract props which is allowed to be inserted
    const insertObject = extractProps(stat, ['row_count']);

    const statData = await this.get(workspaceId, modelId, ncMeta);

    if (statData) {
      await ncMeta.metaUpdate(null, null, MetaTable.MODEL_STAT, insertObject, {
        fk_workspace_id: workspaceId,
        fk_model_id: modelId,
      });
    } else {
      await ncMeta.metaInsert2(
        null,
        null,
        MetaTable.MODEL_STAT,
        {
          fk_workspace_id: workspaceId,
          fk_model_id: modelId,
          ...insertObject,
        },
        true,
      );
    }

    await NocoCache.del(`${CacheScope.MODEL_STAT}:${workspaceId}:${modelId}`);
    await NocoCache.del(`${CacheScope.MODEL_STAT}:${workspaceId}:sum`);

    return this.get(workspaceId, modelId, ncMeta);
  }

  public static async delete(
    workspaceId: string,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    try {
      await ncMeta.metaDelete(null, null, MetaTable.MODEL_STAT, {
        fk_workspace_id: workspaceId,
        fk_model_id: modelId,
      });

      await NocoCache.del(`${CacheScope.MODEL_STAT}:${workspaceId}:${modelId}`);
      await NocoCache.del(`${CacheScope.MODEL_STAT}:${workspaceId}:sum`);

      return true;
    } catch (error) {
      return false;
    }
  }

  public static async getWorkspaceSum(
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let statData = await NocoCache.get(
      `${CacheScope.MODEL_STAT}:${workspaceId}:sum`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!statData) {
      const row_count = await ncMeta
        .knexConnection(MetaTable.MODEL_STAT)
        .sum('row_count')
        .where({
          fk_workspace_id: workspaceId,
        });

      statData = {
        row_count: row_count[0].sum,
      };

      if (statData) {
        await NocoCache.set(
          `${CacheScope.MODEL_STAT}:${workspaceId}:sum`,
          statData,
        );
      }
    }

    return statData;
  }
}
