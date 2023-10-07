import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { SourcesService } from '~/services/sources.service';

@Processor(JOBS_QUEUE)
export class SourceCreateProcessor {
  private readonly debugLog = debug('nc:jobs:source-create');

  constructor(private readonly sourcesService: SourcesService) {}

  @Process(JobTypes.BaseCreate)
  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const { baseId, source } = job.data;

    const createdBase = await this.sourcesService.baseCreate({
      baseId,
      source,
    });

    if (createdBase.isMeta()) {
      delete createdBase.config;
    }

    this.debugLog(`job completed for ${job.id}`);

    return createdBase;
  }
}
