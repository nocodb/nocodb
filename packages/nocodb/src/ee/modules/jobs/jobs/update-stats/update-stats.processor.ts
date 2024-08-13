import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { Base, Model, ModelStat, Source, Workspace } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, RootScopes } from '~/utils/globals';

@Processor(JOBS_QUEUE)
export class UpdateStatsProcessor {
  private readonly debugLog = debug('nc:jobs:update-stats');

  @Process(JobTypes.UpdateModelStat)
  async updateModelStat(job: Job) {
    const {
      context,
      fk_workspace_id,
      fk_model_id,
      row_count: _row_count,
      updated_at,
    } = job.data;

    let row_count = _row_count;

    if (!fk_workspace_id) {
      this.debugLog(`No workspace id provided`);
      return false;
    }

    const model = await Model.get(context, fk_model_id);

    if (row_count === undefined) {
      const source = await Source.get(context, model.source_id);

      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
      });
      row_count = await baseModel.count();
    }

    const stat = await ModelStat.get(context, fk_workspace_id, fk_model_id);

    if (stat && stat.updated_at && updated_at) {
      const diff =
        new Date(updated_at).getTime() - new Date(stat.updated_at).getTime();
      if (diff < 0) {
        this.debugLog(
          `Skipping stats update for model ${fk_model_id} as it was updated ${diff}ms ago`,
        );
        return true;
      }
    }

    await ModelStat.upsert(context, fk_workspace_id, fk_model_id, {
      row_count,
    });

    this.debugLog(
      `Updated stats for model ${fk_model_id} with row count ${row_count}`,
    );

    return true;
  }

  @Process(JobTypes.UpdateWsStat)
  async updateWorkspaceStat(job: Job) {
    this.debugLog(
      `Start updating stats for workspace ${job.data.fk_workspace_id}`,
    );

    const { fk_workspace_id, force } = job.data;

    const workspace = await Workspace.get(fk_workspace_id);

    if (!workspace) {
      this.debugLog(`Workspace not found`);
      return false;
    }

    const updatedModels = await NocoCache.get(
      `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}:models`,
      CacheGetType.TYPE_ARRAY,
    );

    if (updatedModels?.length && !force) {
      for (const fk_model_id of updatedModels) {
        const model = await Model.get(
          {
            workspace_id: RootScopes.BYPASS,
            base_id: RootScopes.BYPASS,
          },
          fk_model_id,
        );

        if (!model) {
          continue;
        }

        const modelContext = {
          workspace_id: model.fk_workspace_id,
          base_id: model.base_id,
        };

        const source = await Source.get(modelContext, model.source_id);

        if (!source || !source.isMeta()) {
          continue;
        }

        try {
          await this.updateModelStat({
            data: {
              context: modelContext,
              fk_workspace_id,
              fk_model_id,
              updated_at: new Date().toISOString(),
            },
          } as any);
        } catch (e) {
          this.debugLog(`Failed to update stats for model ${fk_model_id}`);
        }
      }

      await NocoCache.del(
        `${CacheScope.WORKSPACE_CREATE_DELETE_COUNTER}:${fk_workspace_id}:models`,
      );
    } else {
      const bases = await Base.listByWorkspace(workspace.id);

      for (const base of bases) {
        const models = await Model.list(
          {
            workspace_id: base.fk_workspace_id,
            base_id: base.id,
          },
          {
            base_id: base.id,
            source_id: base.sources[0].id,
          },
        );

        try {
          for (const model of models) {
            const modelContext = {
              workspace_id: model.fk_workspace_id,
              base_id: model.base_id,
            };

            await this.updateModelStat({
              data: {
                context: modelContext,
                fk_workspace_id,
                fk_model_id: model.id,
                updated_at: new Date().toISOString(),
              },
            } as any);
          }
        } catch (e) {
          this.debugLog(`Failed to update stats for base ${base.id}`);
        }
      }
    }

    this.debugLog(`Finished updating stats for workspace ${fk_workspace_id}`);

    return true;
  }

  @Process(JobTypes.UpdateSrcStat)
  async UpdateSrcStat(_job: Job) {
    /* TODO - fix for context
    this.debugLog(`Start fetching stats for external sources`);

    const lastFetch = await NocoCache.get(
      'lastFetchExternalSourceStats',
      CacheGetType.TYPE_STRING,
    );

    if (lastFetch) {
      const diff = new Date().getTime() - new Date(lastFetch).getTime();
      const diffInHours = diff / 1000 / 60 / 60;
      // if last fetch was less than 4 hours ago, skip
      if (diffInHours < 4) {
        this.debugLog(
          `Skipping external source stats update as it was updated ${diffInHours} hours ago`,
        );
        return true;
      }
    }

    await NocoCache.set(
      'lastFetchExternalSourceStats',
      new Date().toISOString(),
    );

    const sources = await Source.list(context, {
      baseId: null,
    });

    for (const source of sources) {
      if (source.isMeta()) continue;

      const models = await Model.list(context, {
        base_id: source.base_id,
        source_id: source.id,
      });

      try {
        for (const model of models) {
          // TODO - remove this on next release
          await ModelStat.delete(context, model.fk_workspace_id, model.id);

          await this.updateModelStat({
            data: {
              fk_workspace_id: model.fk_workspace_id,
              fk_model_id: model.id,
            },
          } as any);
        }
      } catch (e) {
        this.debugLog(`Failed to update stats for source ${source.id}`);
      }
    }

    this.debugLog(`Finished updating stats for external sources`);

    return true;
    */
  }
}
