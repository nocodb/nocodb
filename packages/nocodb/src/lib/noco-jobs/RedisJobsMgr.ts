import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import JobMgr from './JobMgr';

export default class RedisJobsMgr extends JobMgr {
  queue: { [jobName: string]: Queue };
  workers: { [jobName: string]: Worker };

  constructor(config: any) {
    super();
    this.queue = {};
    this.workers = {};
    const connection = new Redis(config);
  }

  async add(jobName: string, payload: any): Promise<any> {
    this.queue[jobName] = this.queue[jobName] || new Queue(jobName);
    this.queue[jobName].add(jobName, payload);
  }

  addJobWorker(jobName: string, workerFn: (payload: any) => void) {
    this.worker[jobName] = new Worker(jobName);
  }
}
