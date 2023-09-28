import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { BasesService } from '~/services/bases.service';

@Processor(JOBS_QUEUE)
export class BaseDeleteProcessor {
  private readonly debugLog = debug('nc:meta-sync:processor');

  constructor(private readonly basesService: BasesService) {}

  @Process(JobTypes.BaseDelete)
  async job(job: Job) {
    const { baseId } = job.data;

    await this.basesService.baseDelete({
      baseId,
    });

    return true;
  }
}
