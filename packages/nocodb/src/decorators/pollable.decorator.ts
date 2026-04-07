import { Inject, Logger } from '@nestjs/common';
import { getCircularReplacer } from 'nocodb-sdk';
import { customAlphabet } from 'nanoid';
import { JobTypes } from '~/interface/Jobs';
import { NocoJobsService } from '~/services/noco-jobs.service';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

const logger = new Logger('Pollable');

/**
 * Decorator that makes a service method async-pollable.
 *
 * Instead of blocking until the method completes, the caller receives
 * { id: jobId } immediately. The actual work runs in the job queue
 * (Bull with Redis, or fallback p-queue). The frontend polls
 * /jobs/listen for the result.
 *
 * Usage:
 *   @Pollable()
 *   async predictSchema(context, params) { ... }
 *
 * The processor calls __original to bypass the decorator.
 */
export function Pollable(): MethodDecorator {
  const injectNocoJobsService = Inject(NocoJobsService);

  return (target, key, descriptor: PropertyDescriptor) => {
    injectNocoJobsService(target, '_nocoJobsService');

    const service = target.constructor.name;
    const method = key.toString();
    const originalMethod = descriptor.value;

    const wrappedFn = async function (...args: any[]) {
      const nocoJobsService: NocoJobsService = this._nocoJobsService;

      if (!nocoJobsService) {
        return originalMethod.apply(this, args);
      }

      const serializedArgs = args.map((arg) => {
        if (typeof arg === 'function') {
          logger.error(
            'Function passed as argument to Pollable decorator, only JSON serializable data is allowed',
          );
          return;
        }

        if (typeof arg === 'object') {
          try {
            return JSON.parse(JSON.stringify(arg, getCircularReplacer()));
          } catch (e) {
            logger.error(e);
            return;
          }
        }

        return arg;
      });

      const jobId = `job${nanoidv2()}`;

      const job = await nocoJobsService.add(
        JobTypes.UseWorker,
        { service, method, args: serializedArgs },
        { jobId },
      );

      return { id: job.id };
    };

    // Store original so UseWorkerProcessor can bypass the decorator
    wrappedFn['__original'] = originalMethod;

    descriptor.value = wrappedFn;

    return descriptor;
  };
}
