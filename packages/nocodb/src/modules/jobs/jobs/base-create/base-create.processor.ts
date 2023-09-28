import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { BasesService } from '~/services/bases.service';

@Processor(JOBS_QUEUE)
export class BaseCreateProcessor {
  private readonly debugLog = debug('nc:meta-sync:processor');

  constructor(private readonly basesService: BasesService) {}

  @Process(JobTypes.BaseCreate)
  async job(job: Job) {
    const { projectId, base } = job.data;

    const createdBase = await this.basesService.baseCreate({
      projectId,
      base,
    });

    if (createdBase.isMeta()) {
      delete createdBase.config;
    }

    return createdBase;
  }
}
