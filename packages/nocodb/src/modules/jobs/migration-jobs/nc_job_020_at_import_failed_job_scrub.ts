import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { JobStatus, JobTypes } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

// Failed jobs stay in the queue; drop the Airtable token older AtImport payloads carried.
@Injectable()
export class AtImportFailedJobScrubMigration {
  private readonly logger = new Logger(AtImportFailedJobScrubMigration.name);

  constructor(
    @Inject(forwardRef(() => 'JobsService'))
    private readonly jobsService: IJobsService,
  ) {}

  // Best-effort: a scrub that cannot run must not block later migration jobs.
  async job() {
    let failed: Awaited<ReturnType<IJobsService['jobsQueue']['getJobs']>>;
    try {
      failed =
        (await this.jobsService.jobsQueue.getJobs([JobStatus.FAILED])) ?? [];
    } catch (e) {
      this.logger.warn(`Could not list failed jobs to scrub: ${e?.message}`);
      return true;
    }

    let scrubbed = 0;

    for (const job of failed) {
      if (
        job?.data?.jobName !== JobTypes.AtImport ||
        !('apiKey' in job.data) ||
        typeof job.update !== 'function'
      ) {
        continue;
      }

      const { apiKey: _apiKey, ...data } = job.data;

      try {
        await job.update(data);
        scrubbed++;
      } catch (e) {
        this.logger.warn(`Could not scrub failed job ${job.id}: ${e?.message}`);
      }
    }

    this.logger.log(
      `Scrubbed the Airtable token from ${scrubbed} failed job(s)`,
    );

    return true;
  }
}
