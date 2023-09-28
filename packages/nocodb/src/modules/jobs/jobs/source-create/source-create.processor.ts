import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { SourcesService } from '~/services/sources.service';

@Processor(JOBS_QUEUE)
export class SourceCreateProcessor {
  private readonly debugLog = debug('nc:meta-sync:processor');

  constructor(private readonly sourcesService: SourcesService) {}

  @Process(JobTypes.BaseCreate)
  async job(job: Job) {
    const { baseId, source } = job.data;

    const createdBase = await this.sourcesService.baseCreate({
      baseId,
      source,
    });

    if (createdBase.isMeta()) {
      delete createdBase.config;
    }

    return createdBase;
  }
}
