jest.mock('~/Noco', () => ({ __esModule: true, default: {} }));
jest.mock('~/models', () => ({ Job: {} }));
jest.mock('~/modules/jobs/jobs-event.service', () => ({
  JobsEventService: class {},
}));
jest.mock('./fallback/fallback-queue.service', () => ({
  QueueService: class {},
}));
jest.mock('~/modules/jobs/redis/jobs-redis', () => ({
  JobsRedis: { workerCallbacks: {}, workerCount: jest.fn() },
}));

import { JobsService as FallbackJobsService } from './fallback/jobs.service';
import { JobsService as RedisJobsService } from './redis/jobs.service';
import { JobTypes } from '~/interface/Jobs';

describe('attachment cleanup scheduling', () => {
  it('registers the recurring cleanup job in Redis mode', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      resume: jest.fn(),
    };
    const service = new RedisJobsService(queue as any);

    jest.spyOn(service, 'toggleQueue').mockResolvedValue(undefined);
    jest.spyOn(service, 'add').mockResolvedValue(undefined as any);

    await service.onModuleInit();

    expect(queue.add).toHaveBeenCalledWith(
      { jobName: JobTypes.AttachmentCleanUp, context: {} },
      {
        jobId: JobTypes.AttachmentCleanUp,
        repeat: { cron: '0 */5 * * *' },
      },
    );
  });

  it('registers the recurring cleanup job in fallback mode', async () => {
    const queue = { add: jest.fn().mockReturnValue(undefined) };
    const service = new FallbackJobsService(queue as any);

    jest.spyOn(service, 'add').mockResolvedValue(undefined as any);

    await service.onModuleInit();

    expect(queue.add).toHaveBeenCalledWith(
      JobTypes.AttachmentCleanUp,
      {},
      {
        jobId: JobTypes.AttachmentCleanUp,
        repeat: { cron: '0 */5 * * *' },
      },
    );
  });
});
