import { UpdateStatsProcessor as UpdateStatsProcessorEE } from 'src/ee/modules/jobs/jobs/update-stats/update-stats.processor';
import type { Job } from 'bull';

export class UpdateStatsProcessor extends UpdateStatsProcessorEE {
  override async updateModelStat(_job: Job) {
    // noop — stats tracking is not needed for on-prem
    return true;
  }

  override async updateWorkspaceStat(_job: Job) {
    // noop — stats tracking is not needed for on-prem
    return true;
  }
}
