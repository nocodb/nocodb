import { JobsService as JobsServiceCE } from 'src/modules/jobs/redis/jobs.service';
import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import type { OnModuleInit } from '@nestjs/common';
import { InstanceCommands, JOBS_QUEUE } from '~/interface/Jobs';
import { JobsRedisService } from '~/modules/jobs/redis/jobs-redis.service';
import { Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

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
    if (process.env.NC_WORKER_CONTAINER === 'true') {
      this.jobsRedisService.workerCallbacks[InstanceCommands.RESET] =
        async () => {
          this.logger.log('Pausing local queue and stopping worker');
          await this.jobsQueue.pause(true);
          this.jobsQueue.whenCurrentJobsFinished().then(() => {
            process.exit(0);
          });
        };

      this.jobsRedisService.workerCallbacks[InstanceCommands.RELEASE] = async (
        sourceIds,
      ) => {
        const sources = await Promise.all(
          sourceIds.split(',').map(async (id) => {
            const source = await Source.get(id);
            if (!source) {
              this.logger.log(`Source ${source} not found`);
            }
            return source;
          }),
        );
        for (const source of sources) {
          if (!source) {
            continue;
          }
          await NcConnectionMgrv2.deleteAwait(source);
          this.logger.log(`Released source ${source.id}`);
        }
      };
    } else {
      this.jobsRedisService.primaryCallbacks[InstanceCommands.RELEASE] = async (
        sourceIds,
      ) => {
        const sources = await Promise.all(
          sourceIds.split(',').map(async (id) => {
            const source = await Source.get(id);
            if (!source) {
              this.logger.log(`Source ${source} not found`);
            }
            return source;
          }),
        );
        for (const source of sources) {
          if (!source) {
            continue;
          }
          await NcConnectionMgrv2.deleteAwait(source);
          this.logger.log(`Released source ${source.id}`);
        }
      };
    }
    super.onModuleInit();
  }
}
