import { JobsService as JobsServiceCE } from 'src/modules/jobs/redis/jobs.service';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { NcDebug } from 'nc-gui/utils/debug';
import type { JobOptions } from 'bull';
import type { OnModuleInit } from '@nestjs/common';
import { InstanceCommands, JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { TelemetryService } from '~/services/telemetry.service';
import { JobsRedis } from '~/modules/jobs/redis/jobs-redis';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Injectable()
export class JobsService extends JobsServiceCE implements OnModuleInit {
  protected logger = new Logger(JobsService.name);
  protected workerGroupId: string | null = null;

  constructor(
    @InjectQueue(JOBS_QUEUE) public readonly jobsQueue: Queue,
    protected readonly telemetryService: TelemetryService,
  ) {
    super(jobsQueue);
  }

  // pause primary instance queue
  async onModuleInit() {
    const timeout = setTimeout(() => {
      this.logger.error('Failed to initialize JobsService');
      process.exit(1);
    }, 30 * 1000);

    NcDebug.log('JobsService init start');
    await JobsRedis.initJobs();
    NcDebug.log('JobsService init complete');

    await this.jobsQueue.add(
      {
        jobName: JobTypes.HealthCheck,
      },
      {
        jobId: JobTypes.HealthCheck,
        repeat: { cron: '*/10 * * * *' },
      },
    );

    // for development and test env, we run the job every minute
    // for production, we run the job every hour
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_ENV === 'development'
    ) {
      await this.jobsQueue.add(
        {
          jobName: JobTypes.UpdateUsageStats,
        },
        {
          jobId: JobTypes.UpdateUsageStats,
          repeat: { cron: '* * * * *' },
        },
      );
    } else {
      await this.jobsQueue.removeRepeatable({
        jobId: JobTypes.UpdateUsageStats,
        cron: '* * * * *',
      });

      await this.jobsQueue.add(
        {
          jobName: JobTypes.UpdateUsageStats,
        },
        {
          jobId: JobTypes.UpdateUsageStats,
          repeat: { cron: '1 * * * *' },
        },
      );
    }

    // common cmds
    const sourceReleaseCmd = async (commaSeperatedSourceIds: string) => {
      const sourceIds = commaSeperatedSourceIds.split(',');
      for (const sourceId of sourceIds) {
        await NcConnectionMgrv2.deleteConnectionRef(sourceId);
      }
    };

    if (process.env.NC_WORKER_CONTAINER === 'true') {
      const assignWorkerGroup = async (workerGroupId: string) => {
        if (this.workerGroupId) {
          this.logger.log(
            `Worker group id already assigned: ${this.workerGroupId}`,
          );
          return;
        }

        this.workerGroupId = workerGroupId;
        this.logger.log(`Worker group id assigned: ${this.workerGroupId}`);
      };

      const stopOtherWorkerGroups = async (preserveGroupId: string) => {
        if (this.workerGroupId === preserveGroupId) {
          this.logger.log(
            `Worker group id is the same as the one to preserve: ${preserveGroupId}`,
          );
          return;
        }

        this.logger.log(`Stopping worker from group: ${preserveGroupId}`);

        this.jobsQueue.whenCurrentJobsFinished().then(() => {
          process.kill(process.pid, 'SIGINT');
        });
      };

      JobsRedis.workerCallbacks[InstanceCommands.ASSIGN_WORKER_GROUP] =
        assignWorkerGroup;
      JobsRedis.workerCallbacks[InstanceCommands.STOP_OTHER_WORKER_GROUPS] =
        stopOtherWorkerGroups;

      JobsRedis.workerCallbacks[InstanceCommands.RELEASE] = sourceReleaseCmd;
    } else {
      JobsRedis.primaryCallbacks[InstanceCommands.RELEASE] = sourceReleaseCmd;
    }

    await super.onModuleInit();

    clearTimeout(timeout);
  }

  async add(name: string, data: any, options?: JobOptions) {
    const res = await super.add(name, data, options);

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
