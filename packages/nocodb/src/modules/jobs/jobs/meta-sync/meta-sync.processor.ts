import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import type { NcRequest } from '~/interface/config';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { MetaDiffsService } from '~/services/meta-diffs.service';

@Processor(JOBS_QUEUE)
export class MetaSyncProcessor {
  private readonly debugLog = debug('nc:jobs:meta-sync');

  constructor(private readonly metaDiffsService: MetaDiffsService) {}

  @Process(JobTypes.MetaSync)
  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const info: {
      baseId: string;
      sourceId: string;
      user: any;
      req: NcRequest;
    } = job.data;

    if (info.sourceId === 'all') {
      await this.metaDiffsService.metaDiffSync({
        baseId: info.baseId,
        req: info.req,
      });
    } else {
      await this.metaDiffsService.baseMetaDiffSync({
        baseId: info.baseId,
        sourceId: info.sourceId,
        req: info.req,
      });
    }

    this.debugLog(`job completed for ${job.id}`);
  }
}
