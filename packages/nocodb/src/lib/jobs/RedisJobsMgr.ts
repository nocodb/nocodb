import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import JobsMgr from './JobsMgr';

export default class RedisJobsMgr extends JobsMgr {
  queue: { [jobName: string]: Queue };
  workers: { [jobName: string]: Worker };
  connection: Redis;

  constructor(config: any) {
    super();
    this.queue = {};
    this.workers = {};
    this.connection = new Redis(config);
  }

  async add(
    jobName: string,
    payload: any
    // options?: {
    //   onSuccess?: (payload: any) => void;
    //   onFailure?: (payload: any, msg: string) => void;
    //   onProgress?: (payload: any, msgOrData: any) => void;
    // }
  ): Promise<any> {
    this.queue[jobName] =
      this.queue[jobName] ||
      new Queue(jobName, { connection: this.connection });
    this.queue[jobName].add(jobName, payload);
  }

  addJobWorker(
    jobName: string,
    workerFn: (
      payload: any,
      progressCbk?: (payload: any, msg?: string) => void
    ) => void
  ) {
    this.workers[jobName] = new Worker(
      jobName,
      async payload => {
        try {
          await workerFn(payload.data, (...args) =>
            this.invokeProgressCbks(jobName, ...args)
          );
          await this.invokeFailureCbks(jobName, payload.data);
        } catch (e) {
          await this.invokeFailureCbks(jobName, payload.data);
        }
      },
      { connection: this.connection }
    );
  }
}
