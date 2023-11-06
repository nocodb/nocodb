import { JobsService as JobsServiceCE } from 'src/modules/jobs/redis/jobs.service';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import type { OnModuleInit } from '@nestjs/common';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { JobsRedisService } from '~/modules/jobs/redis/jobs-redis.service';

@Injectable()
export class JobsService extends JobsServiceCE implements OnModuleInit {
  constructor(
    @InjectQueue(JOBS_QUEUE) public readonly jobsQueue: Queue,
    protected readonly jobsRedisService: JobsRedisService,
  ) {
    super(jobsQueue, jobsRedisService);
  }

  // pause primary instance queue
  async onModuleInit() {
    // run initially and then every 8 hours
    // this.jobsQueue.add(JobTypes.UpdateSrcStat, {});
    // this.jobsQueue.add(
    //   JobTypes.UpdateSrcStat,
    //   {},
    //   { repeat: { cron: '0 */8 * * *' } },
    // );
    super.onModuleInit();
  }
}
