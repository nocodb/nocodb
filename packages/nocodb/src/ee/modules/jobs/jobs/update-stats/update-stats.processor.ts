import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { Base, Model, ModelStat, Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Processor(JOBS_QUEUE)
export class UpdateStatsProcessor {
  private readonly debugLog = debug('nc:update-stats:processor');

  constructor() {}

  @Process(JobTypes.UpdateStats)
  async job(job: Job) {
    const {
      fk_workspace_id: _fk_workspace_id,
      fk_model_id,
      row_count: _row_count,
    } = job.data;

    let base = null;
    let model = null;
    let fk_workspace_id = _fk_workspace_id;
    let row_count = _row_count;

    if (!fk_workspace_id) {
      model = await Model.get(fk_model_id);
      base = await Base.get(model.base_id);
      fk_workspace_id = (base as any).fk_workspace_id;
    }

    if (!fk_workspace_id) {
      this.debugLog(`Workspace not found for model ${fk_model_id}`);
      return false;
    }

    if (row_count === undefined) {
      if (!model) model = await Model.get(fk_model_id);
      const source = await Source.get(model.source_id);
      const baseModel = await Model.getBaseModelSQL({
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
      });
      row_count = await baseModel.count();
    }

    const stat = await ModelStat.get(fk_workspace_id, fk_model_id);

    if (stat && stat.updated_at) {
      const utcNow = new Date().toISOString();
      const diff =
        new Date(utcNow).getTime() - new Date(stat.updated_at).getTime();
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
}
