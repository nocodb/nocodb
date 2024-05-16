import { JobsService as JobsServiceCE } from 'src/modules/jobs/redis/jobs.service';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import type { OnModuleInit } from '@nestjs/common';
import { InstanceCommands, JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { JobsRedisService } from '~/modules/jobs/redis/jobs-redis.service';
import { Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { TelemetryService } from '~/services/telemetry.service';

@Injectable()
export class JobsService extends JobsServiceCE implements OnModuleInit {
  protected logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue(JOBS_QUEUE) public readonly jobsQueue: Queue,
    protected readonly jobsRedisService: JobsRedisService,
    protected readonly telemetryService: TelemetryService,
  ) {
    super(jobsQueue, jobsRedisService);
  }

  // pause primary instance queue
  async onModuleInit() {
    await this.jobsQueue.add(
      JobTypes.HealthCheck,
      {},
      { repeat: { cron: '*/10 * * * *' } },
    );

    if (process.env.NC_WORKER_CONTAINER === 'true') {
      this.jobsRedisService.workerCallbacks[InstanceCommands.RESET] =
        async () => {
          this.logger.log('Pausing local queue and stopping worker');
          await this.jobsQueue.pause(true);

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
