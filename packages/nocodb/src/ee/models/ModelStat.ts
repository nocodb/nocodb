import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { Model, Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

// PG returns BIGINT SUM/COUNT as a string; coerce to a clamped non-negative
// integer so downstream arithmetic (checkLimit's `count + delta`) is numeric.
function toIntegerCount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

export default class ModelStat {
  // primary: [fk_workspace_id, base_id, fk_model_id]
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
      { workspace_id: workspaceId, base_id: null },
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
          { workspace_id: workspaceId, base_id: null },
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
    const insertObject = extractProps(stat, ['row_count']);
    if ('row_count' in insertObject) {
      insertObject.row_count = toIntegerCount(insertObject.row_count);
    }

    const model = await Model.get(context, modelId, false, ncMeta);
    if (!model) return null;

    const source = await Source.get(context, model.source_id, false, ncMeta);
    if (!source) return null;

    const is_external = !source.isMeta();

    const now = ncMeta.now();

    // Atomic upsert — avoids race condition from GET-then-INSERT/UPDATE
    await ncMeta
      .knexConnection(MetaTable.MODEL_STAT)
      .insert({
        fk_workspace_id: workspaceId,
        fk_model_id: modelId,
        base_id: model.base_id,
        is_external,
        ...insertObject,
        created_at: now,
        updated_at: now,
      })
      .onConflict(['fk_workspace_id', 'base_id', 'fk_model_id'])
      .merge({
        ...insertObject,
        is_external,
        updated_at: now,
      });

    await this.invalidate(workspaceId, modelId);

    return this.get(context, workspaceId, modelId, ncMeta);
  }

  // Fresh count + upsert in one shot — keeps type-coercion + invalidation
  // in one place so callers don't redo it.
  public static async recount(
    context: NcContext,
    model: Model,
    ncMeta = Noco.ncMeta,
  ): Promise<number | null> {
    if (!model) return null;
    if (model.mm) return null;

    const source = await Source.get(context, model.source_id, false, ncMeta);
    if (!source) return null;

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });
    const row_count = toIntegerCount(await baseModel.count());

    await this.upsert(
      context,
      model.fk_workspace_id,
      model.id,
      { row_count },
      ncMeta,
    );

    return row_count;
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

      await this.invalidate(workspaceId, modelId);

      return true;
    } catch (error) {
      return false;
    }
  }

  public static async deleteByBaseId(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const models = await Model.list(
      context,
      {
        base_id: baseId,
      },
      ncMeta,
    );

    for (const model of models) {
      await this.delete(context, context.workspace_id, model.id, ncMeta);
    }

    return true;
  }

  public static async deleteByWorkspaceId(
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta
      .knexConnection(MetaTable.MODEL_STAT)
      .where({
        fk_workspace_id: workspaceId,
      })
      .delete();

    await this.invalidateWorkspaceSum(workspaceId);

    return true;
  }

  public static async getWorkspaceSum(
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{ row_count: number | null }> {
    let statData = await NocoCache.get(
      { workspace_id: workspaceId, base_id: null },
      `${CacheScope.MODEL_STAT}:${workspaceId}:sum`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!statData) {
      // Join MODELS so soft-deleted tables (base trash) drop out of the sum.
      const result = await ncMeta
        .knexConnection(MetaTable.MODEL_STAT)
        .sum(`${MetaTable.MODEL_STAT}.row_count as sum`)
        .leftJoin(
          MetaTable.MODELS,
          `${MetaTable.MODELS}.id`,
          `${MetaTable.MODEL_STAT}.fk_model_id`,
        )
        .where(`${MetaTable.MODEL_STAT}.fk_workspace_id`, workspaceId)
        .where(`${MetaTable.MODEL_STAT}.is_external`, false)
        .where(function () {
          this.where(`${MetaTable.MODELS}.deleted`, false).orWhereNull(
            `${MetaTable.MODELS}.deleted`,
          );
        })
        .first();

      statData = {
        row_count: result?.sum != null ? toIntegerCount(result.sum) : null,
      };

      await NocoCache.set(
        { workspace_id: workspaceId, base_id: null },
        `${CacheScope.MODEL_STAT}:${workspaceId}:sum`,
        statData,
      );
    }

    return statData;
  }

  // Also called from Model.softDelete (table trash / restore) — the join
  // predicate flips even though no MODEL_STAT row was touched.
  public static async invalidateWorkspaceSum(workspaceId: string) {
    await NocoCache.del(
      { workspace_id: workspaceId, base_id: null },
      `${CacheScope.MODEL_STAT}:${workspaceId}:sum`,
    );
  }

  private static async invalidate(workspaceId: string, modelId: string) {
    await NocoCache.del(
      { workspace_id: workspaceId, base_id: null },
      `${CacheScope.MODEL_STAT}:${workspaceId}:${modelId}`,
    );
    await this.invalidateWorkspaceSum(workspaceId);
  }
}
