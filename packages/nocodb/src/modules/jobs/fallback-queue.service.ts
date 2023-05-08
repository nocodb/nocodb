import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import Emittery from 'emittery';
import { JobStatus, JobTypes } from '../../interface/Jobs';
import { DuplicateProcessor } from './export-import/duplicate.processor';
import { JobsEventService } from './jobs-event.service';
import { AtImportProcessor } from './at-import/at-import.processor';

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

  constructor(
    private readonly jobsEventService: JobsEventService,
    private readonly duplicateProcessor: DuplicateProcessor,
    private readonly atImportProcessor: AtImportProcessor,
  ) {
    this.emitter.on(JobStatus.ACTIVE, (data: { job: Job }) => {
      const job = this.queueMemory.find(
        (job) => job.id === data.job.id && job.name === data.job.name,
      );
      job.status = JobStatus.ACTIVE;
      this.jobsEventService.onActive.apply(this.jobsEventService, [job as any]);
    });
    this.emitter.on(JobStatus.COMPLETED, (data: { job: Job; result: any }) => {
      const job = this.queueMemory.find(
        (job) => job.id === data.job.id && job.name === data.job.name,
      );
      job.status = JobStatus.COMPLETED;
      this.jobsEventService.onCompleted.apply(this.jobsEventService, [
        job,
        data.result,
      ]);
    });
    this.emitter.on(JobStatus.FAILED, (data: { job: Job; error: Error }) => {
      const job = this.queueMemory.find(
        (job) => job.id === data.job.id && job.name === data.job.name,
      );
      job.status = JobStatus.FAILED;
      this.jobsEventService.onFailed.apply(this.jobsEventService, [
        job,
        data.error,
      ]);
    });
  }

  jobMap = {
    [JobTypes.DuplicateBase]: {
      this: this.duplicateProcessor,
      fn: this.duplicateProcessor.duplicateBase,
    },
    [JobTypes.DuplicateModel]: {
      this: this.duplicateProcessor,
      fn: this.duplicateProcessor.duplicateModel,
    },
    [JobTypes.AtImport]: {
      this: this.atImportProcessor,
      fn: this.atImportProcessor.job,
    },
  };

  async jobWrapper(job: Job) {
    this.emitter.emit(JobStatus.ACTIVE, { job });
    try {
      const result = await this.jobMap[job.name].fn.apply(
        this.jobMap[job.name].this,
        [job],
      );
      this.emitter.emit(JobStatus.COMPLETED, { job, result });
    } catch (error) {
      this.emitter.emit(JobStatus.FAILED, { job, error });
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
    const job = { id: `${id}`, name, status: JobStatus.WAITING, data };
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
