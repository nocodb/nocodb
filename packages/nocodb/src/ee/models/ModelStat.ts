import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { Model, Source } from '~/models';

export default class ModelStat {
  // primary: [fk_workspace_id, fk_model_id]
  // indexes: [fk_workspace_id, fk_model_id], [fk_workspace_id]
  fk_workspace_id?: string;
  fk_model_id?: string;
  row_count?: number;
  is_external?: boolean;

  created_at?: string;
  updated_at?: string;

  base_id?: string;

  constructor(stat: ModelStat) {
    Object.assign(this, stat);
  }

  public static async get(
    context: NcContext,
    workspaceId: string,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let statData = await NocoCache.get(
      `${CacheScope.MODEL_STAT}:${workspaceId}:${modelId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!statData) {
      statData = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODEL_STAT,
        {
          fk_workspace_id: workspaceId,
          fk_model_id: modelId,
        },
      );
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
    context: NcContext,
    workspaceId: string,
    modelId: string,
    stat: Partial<ModelStat>,
    ncMeta = Noco.ncMeta,
  ) {
    // extract props which is allowed to be inserted
    const insertObject = extractProps(stat, ['row_count']);

    const statData = await this.get(context, workspaceId, modelId, ncMeta);

    if (statData) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.MODEL_STAT,
        insertObject,
        {
          fk_workspace_id: workspaceId,
          fk_model_id: modelId,
        },
      );
    } else {
      const model = await Model.get(context, modelId, ncMeta);

      const source = await Source.get(context, model.source_id, false, ncMeta);

      const is_external = !source.isMeta();

      await ncMeta.metaInsert2(
        context.workspace_id,
        context.base_id,
        MetaTable.MODEL_STAT,
        {
          fk_workspace_id: workspaceId,
          fk_model_id: modelId,
          is_external,
          ...insertObject,
        },
        true,
      );
    }

    await NocoCache.del(`${CacheScope.MODEL_STAT}:${workspaceId}:${modelId}`);
    await NocoCache.del(`${CacheScope.MODEL_STAT}:${workspaceId}:sum`);

    return this.get(context, workspaceId, modelId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    workspaceId: string,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ) {
    try {
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.MODEL_STAT,
        {
          fk_workspace_id: workspaceId,
          fk_model_id: modelId,
        },
      );

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
        .sum('row_count', { as: 'sum' })
        .where({
          fk_workspace_id: workspaceId,
          is_external: false,
        })
        .first();

      statData = {
        row_count: row_count.sum,
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
