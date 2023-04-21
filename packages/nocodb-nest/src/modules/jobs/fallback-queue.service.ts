import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import Emittery from 'emittery';
import { DuplicateProcessor } from './export-import/duplicate.processor';

interface Job {
  id: string;
  name: string;
  status: string;
  data: any;
}

@Injectable()
export class QueueService {
  static queue = new PQueue({ concurrency: 1 });
  static queueIndex = 1;
  static processed = 0;
  static queueMemory: Job[] = [];
  static emitter = new Emittery();

  constructor(private readonly duplicateProcessor: DuplicateProcessor) {
    this.emitter.on('active', (data: any) => {
      const job = this.queueMemory.find(
        (job) => job.id === data.id && job.name === data.name,
      );
      job.status = 'active';
      this.duplicateProcessor.onActive.apply(this.duplicateProcessor, [
        job as any,
      ]);
    });
    this.emitter.on('completed', (data: any) => {
      const job = this.queueMemory.find(
        (job) => job.id === data.id && job.name === data.name,
      );
      job.status = 'completed';
      this.duplicateProcessor.onCompleted.apply(this.duplicateProcessor, [
        data as any,
      ]);
    });
    this.emitter.on('failed', (data: { job: Job; error: Error }) => {
      const job = this.queueMemory.find(
        (job) => job.id === data.job.id && job.name === data.job.name,
      );
      job.status = 'failed';
      this.duplicateProcessor.onFailed.apply(this.duplicateProcessor, [
        data.job as any,
        data.error,
      ]);
    });
  }

  jobMap = {
    duplicate: this.duplicateProcessor.duplicateBase,
  };

  async jobWrapper(job: Job) {
    this.emitter.emit('active', job);
    try {
      await this.jobMap[job.name].apply(this.duplicateProcessor, [job]);
      this.emitter.emit('completed', job);
    } catch (error) {
      this.emitter.emit('failed', { job, error });
    }
  }

  get emitter() {
    return QueueService.emitter;
  }

  get queue() {
    return QueueService.queue;
  }

  get queueMemory() {
    return QueueService.queueMemory;
  }

  get queueIndex() {
    return QueueService.queueIndex;
  }

  set queueIndex(index: number) {
    QueueService.queueIndex = index;
  }

  async add(name: string, data: any) {
    const id = `${this.queueIndex++}`;
    const job = { id: `${id}`, name, status: 'waiting', data };
    this.queueMemory.push(job);
    this.queue.add(() => this.jobWrapper(job));
    return { id, name };
  }

  async getJobs(types: string[] | string) {
    types = Array.isArray(types) ? types : [types];
    return this.queueMemory.filter((q) => types.includes(q.status));
  }

  async getJob(id: string) {
    return this.queueMemory.find((q) => q.id === id);
  }
}
