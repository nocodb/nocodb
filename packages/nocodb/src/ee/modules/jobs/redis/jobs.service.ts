import { JobsService as JobsServiceCE } from 'src/modules/jobs/redis/jobs.service';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import type { OnModuleInit } from '@nestjs/common';
import { InstanceCommands, JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { TelemetryService } from '~/services/telemetry.service';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Injectable()
export class JobsService extends JobsServiceCE implements OnModuleInit {
  protected logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(JOBS_QUEUE) public readonly jobsQueue: Queue,
    protected readonly telemetryService: TelemetryService,
  ) {
    super(jobsQueue);
  }

  // pause primary instance queue
  async onModuleInit() {
    await JobsRedis.initJobs();

    await this.jobsQueue.add(
      JobTypes.HealthCheck,
      {},
      { repeat: { cron: '*/10 * * * *' }, removeOnComplete: true },
    );

    // common cmds
    const sourceReleaseCmd = async (commaSeperatedSourceIds: string) => {
      const sourceIds = commaSeperatedSourceIds.split(',');
      for (const sourceId of sourceIds) {
        await NcConnectionMgrv2.deleteConnectionRef(sourceId);
      }
    };

    if (process.env.NC_WORKER_CONTAINER === 'true') {
      JobsRedis.workerCallbacks[InstanceCommands.RESET] = async () => {
        this.logger.log('Pausing local queue and stopping worker');
        await this.jobsQueue.pause(true, true);

        let runningFor = 0;

        setInterval(() => {
          runningFor += 1;
          this.telemetryService
            .sendSystemEvent({
              event_type: 'worker_alert',
              alert_type: 'warning',
              message: `Worker is running after pause and shutdown for ${runningFor} minutes`,
            })
            .catch((err) => {
              this.logger.error(err);
            });
        }, 60 * 1000); // every minute

        // fallback to shutdown after an hour
        setTimeout(() => {
          process.exit(0);
        }, 1 * 60 * 60 * 1000);

        this.jobsQueue.whenCurrentJobsFinished().then(() => {
          process.exit(0);
        });
      };

      JobsRedis.workerCallbacks[InstanceCommands.RELEASE] = sourceReleaseCmd;
    } else {
      JobsRedis.primaryCallbacks[InstanceCommands.RELEASE] = sourceReleaseCmd;
    }
    super.onModuleInit();
  }

  async add(name: string, data: any) {
    const res = await super.add(name, data);

    this.jobsQueue
      .getActiveCount()
      .then((activeCount) => {
        // currently we only allow 10 concurrent jobs (per worker)
        if (activeCount >= 9) {
          this.jobsQueue
            .getJobCounts()
            .then((stats) => {
              this.telemetryService
                .sendSystemEvent({
                  event_type: 'worker_alert',
                  alert_type: 'warning',
                  message: 'Worker queue is full',
                  stats,
                })
                .catch((err) => {
                  this.logger.error(err);
                });
            })
            .catch((err) => {
              this.logger.error(err);
            });
        }
      })
      .catch((err) => {
        this.logger.error(err);
      });

    return res;
  }
}
