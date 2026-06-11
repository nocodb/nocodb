import { Inject, Logger } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import type { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { PubSubRedis } from '~/redis/pubsub-redis';
import { serializeWorkerArgs } from '~/helpers/serialize-worker-args';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

const logger = new Logger('UseWorker');

export function UseWorker(): MethodDecorator {
  const injectJobsService = Inject('JobsService');

  return (target, key, descriptor: PropertyDescriptor) => {
    if (!PubSubRedis.available) return descriptor;

    if (process.env.NC_WORKER_CONTAINER !== 'false') return descriptor;

    injectJobsService(target, 'jobsService');

    const service = target.constructor.name;
    const method = key.toString();

    descriptor.value = async function (...args: any[]) {
      const serializedArgs = serializeWorkerArgs(args, method, service);

      const jobService: IJobsService = this.jobsService;

      const jobId = `job${nanoidv2()}`;

      return await new Promise((resolve, reject) => {
        PubSubRedis.subscribe<{
          success: boolean;
          result?: any;
          error?: any;
        }>(`worker:job:${jobId}`, async (data, unsubscribe) => {
          if (data.success) {
            resolve(data.result);
          } else {
            reject(data.error);
          }
          await unsubscribe();
        })
          .then(() => {
            jobService
              .add(
                JobTypes.UseWorker,
                {
                  service,
                  method,
                  args: serializedArgs,
                },
                {
                  jobId,
                },
              )
              .catch((e) => {
                logger.error(e);
              });
          })
          .catch((e) => {
            logger.error(e);
            reject(e);
          });
      });
    };

    return descriptor;
  };
}
