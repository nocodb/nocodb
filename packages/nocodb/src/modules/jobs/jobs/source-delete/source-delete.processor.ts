import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { SourcesService } from '~/services/sources.service';

@Processor(JOBS_QUEUE)
export class SourceDeleteProcessor {
  private readonly debugLog = debug('nc:jobs:source-delete');

  constructor(private readonly sourcesService: SourcesService) {}

  @Process(JobTypes.BaseDelete)
  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const { sourceId } = job.data;

    await this.sourcesService.baseDelete({
      sourceId,
    });

    this.debugLog(`job completed for ${job.id}`);

    return true;
  }
}
