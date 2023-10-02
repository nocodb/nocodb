import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { SourcesService } from '~/services/sources.service';

@Processor(JOBS_QUEUE)
export class SourceDeleteProcessor {
  private readonly debugLog = debug('nc:meta-sync:processor');

  constructor(private readonly sourcesService: SourcesService) {}

  @Process(JobTypes.BaseDelete)
  async job(job: Job) {
    const { sourceId } = job.data;

    await this.sourcesService.baseDelete({
      sourceId,
    });

    return true;
  }
}
