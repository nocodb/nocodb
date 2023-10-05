import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { MetaDiffsService } from '~/services/meta-diffs.service';

@Processor(JOBS_QUEUE)
export class MetaSyncProcessor {
  private readonly debugLog = debug('nc:meta-sync:processor');

  constructor(private readonly metaDiffsService: MetaDiffsService) {}

  @Process(JobTypes.MetaSync)
  async job(job: Job) {
    const info: {
      baseId: string;
      sourceId: string;
      user: any;
    } = job.data;

    if (info.sourceId === 'all') {
      await this.metaDiffsService.metaDiffSync({ baseId: info.baseId });
    } else {
      await this.metaDiffsService.baseMetaDiffSync({
        baseId: info.baseId,
        sourceId: info.sourceId,
      });
    }
  }
}
