import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { SourcesService } from '~/services/sources.service';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';

@Processor(JOBS_QUEUE)
export class SourceCreateProcessor {
  private readonly debugLog = debug('nc:jobs:source-create');

  constructor(
    private readonly sourcesService: SourcesService,
    private readonly jobsLogService: JobsLogService,
  ) {}

  @Process(JobTypes.SourceCreate)
  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const { baseId, source, req } = job.data;

    const logBasic = (log) => {
      this.jobsLogService.sendLog(job, { message: log });
      this.debugLog(log);
    };

    const createdBase = await this.sourcesService.baseCreate({
      baseId,
      source,
      logger: logBasic,
      req,
    });

    if (createdBase.isMeta()) {
      delete createdBase.config;
    }

    this.debugLog(`job completed for ${job.id}`);

    return createdBase;
  }
}
