import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { Base, Model, ModelStat, Source, Workspace } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Processor(JOBS_QUEUE)
export class UpdateStatsProcessor {
  private readonly debugLog = debug('nc:jobs:update-stats');

  constructor() {}

  @Process(JobTypes.UpdateModelStat)
  async updateModelStat(job: Job) {
    const {
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

    if (row_count === undefined) {
      const model = await Model.get(fk_model_id);
      const source = await Source.get(model.source_id);

      if (!source || !source.isMeta()) {
        return false;
      }

      const baseModel = await Model.getBaseModelSQL({
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
      });
      row_count = await baseModel.count();
    }

    const stat = await ModelStat.get(fk_workspace_id, fk_model_id);

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

    await ModelStat.upsert(fk_workspace_id, fk_model_id, {
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

    const { fk_workspace_id, updatedModels } = job.data;

    const workspace = await Workspace.get(fk_workspace_id);

    if (!workspace) {
      this.debugLog(`Workspace not found`);
      return false;
    }

    if (updatedModels) {
      for (const fk_model_id of updatedModels) {
        const model = await Model.get(fk_model_id);

        const source = await Source.get(model.source_id);

        if (!source || !source.isMeta()) {
          continue;
        }

        await this.updateModelStat({
          data: {
            fk_workspace_id,
            fk_model_id,
          },
        } as any);
      }
    } else {
      const bases = await Base.listByWorkspace(workspace.id);

      for (const base of bases) {
        const models = await Model.list({
          base_id: base.id,
          source_id: base.sources[0].id,
        });

        for (const model of models) {
          await this.updateModelStat({
            data: {
              fk_workspace_id,
              fk_model_id: model.id,
            },
          } as any);
        }
      }
    }

    this.debugLog(`Finished updating stats for workspace ${fk_workspace_id}`);

    return true;
  }
}
