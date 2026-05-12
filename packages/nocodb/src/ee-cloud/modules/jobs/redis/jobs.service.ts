import { JobsService as JobsServiceEE } from 'src/ee/modules/jobs/redis/jobs.service';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { TelemetryService } from '~/services/telemetry.service';

const MAIL_OUTBOX_RECOVERY_CRON = '*/5 * * * *';
const MAIL_LIMIT_SCANNER_CRON =
  process.env.NC_MAIL_LIMIT_SCANNER_TEST === 'true' ? '* * * * *' : '0 9 * * *';

@Injectable()
export class JobsService extends JobsServiceEE {
  protected logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(JOBS_QUEUE) public readonly jobsQueue: Queue,
    protected readonly telemetryService: TelemetryService,
  ) {
    super(jobsQueue, telemetryService);
  }

  async onModuleInit() {
    await super.onModuleInit();

    await this.jobsQueue.add(
      { jobName: JobTypes.MailOutboxRecovery },
      {
        jobId: JobTypes.MailOutboxRecovery,
        repeat: { cron: MAIL_OUTBOX_RECOVERY_CRON },
      },
    );

    await this.jobsQueue.add(
      { jobName: JobTypes.MailLimitScanner },
      {
        jobId: JobTypes.MailLimitScanner,
        repeat: { cron: MAIL_LIMIT_SCANNER_CRON },
      },
    );
  }
}
