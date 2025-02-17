import { forwardRef, Inject, Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import Emittery from 'emittery';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';
import { JobStatus } from '~/interface/Jobs';
import { JobsMap } from '~/modules/jobs/jobs-map.service';

export interface Job {
  id: string;
  name: string;
  status: string;
  data: any;
}

@Injectable()
export class QueueService {
  static queue = new PQueue({ concurrency: 2 });
  static queueIdCounter = 1;
  static processed = 0;
  static queueMemory: Job[] = [];
  static _emitter: Emittery = new Emittery();

  constructor(
    protected readonly jobsEventService: JobsEventService,
    @Inject(forwardRef(() => JobsMap)) protected readonly jobsMap: JobsMap,
  ) {
    this.emitter.on(JobStatus.ACTIVE, (data: { job: Job }) => {
      const job = this.queueMemory.find((job) => job.id === data.job.id);
      job.status = JobStatus.ACTIVE;
      this.jobsEventService.onActive.apply(this.jobsEventService, [job as any]);
    });
    this.emitter.on(
      JobStatus.COMPLETED,
      (data: { job: Job; result: any; skipEvent?: boolean }) => {
        const job = this.queueMemory.find((job) => job.id === data.job.id);
        job.status = JobStatus.COMPLETED;

        if (!data.skipEvent) {
          this.jobsEventService.onCompleted.apply(this.jobsEventService, [
            job,
            data.result,
          ]);
        }

        // clear job from memory
        this.removeJob(job);
      },
    );
    this.emitter.on(
      JobStatus.FAILED,
      (data: { job: Job; error: Error; skipEvent?: boolean }) => {
        const job = this.queueMemory.find((job) => job.id === data.job.id);
        job.status = JobStatus.FAILED;

        if (!data.skipEvent) {
          this.jobsEventService.onFailed.apply(this.jobsEventService, [
            job,
            data.error,
          ]);
        }

        // clear job from memory
        this.removeJob(job);
      },
    );
  }

  async jobWrapper(job: Job) {
    this.emitter.emit(JobStatus.ACTIVE, { job });

    try {
      if (!this.jobsMap.jobs[job.name]) {
        // job not found - skip
        return;
      }

      const { this: processor, fn = 'job' } = this.jobsMap.jobs[job.name];
      const result = await processor[fn](job);
      this.emitter.emit(JobStatus.COMPLETED, { job, result });
    } catch (error) {
      this.emitter.emit(JobStatus.FAILED, { job, error });
    }
  }

  get emitter(): Emittery {
    return QueueService._emitter;
  }

  get queue() {
    return QueueService.queue;
  }

  get queueMemory() {
    return QueueService.queueMemory;
  }

  get queueIndex() {
    return QueueService.queueIdCounter;
  }

  set queueIndex(index: number) {
    QueueService.queueIdCounter = index;
  }

  add(name: string, data: any, opts?: { jobId?: string; delay?: number }) {
    const id = opts?.jobId || `${this.queueIndex++}`;
    const existingJob = this.queueMemory.find((q) => q.id === id);

    let job;

    const helperFns = (timeoutRef = null) => {
      return {
        getState: () => Promise.resolve(job.status),
        moveToCompleted: (returnValue?: string, _ignoreLock?: boolean) => {
          if (timeoutRef) {
            clearTimeout(timeoutRef);
          }
          this.emitter.emit(JobStatus.COMPLETED, {
            job,
            result: returnValue,
            skipEvent: true,
          });
        },
        moveToFailed: (error?: Error, _ignoreLock?: boolean) => {
          if (timeoutRef) {
            clearTimeout(timeoutRef);
          }
          this.emitter.emit(JobStatus.FAILED, { job, error, skipEvent: true });
        },
      };
    };

    if (existingJob) {
      if (existingJob.status !== JobStatus.WAITING) {
        existingJob.status = JobStatus.WAITING;
      }
      job = existingJob;
    } else {
      job = {
        id: `${id}`,
        name,
        status: JobStatus.WAITING,
        data,
        ...helperFns(),
      };
    }

    if (opts?.delay) {
      if (!existingJob) {
        this.queueMemory.push(job);
      }
      const jobTimeout = setTimeout(() => {
        this.queue.add(() => this.jobWrapper(job));
      }, opts.delay);

      Object.assign(job, helperFns(jobTimeout));
    } else {
      if (!existingJob) {
        this.queueMemory.push(job);
      }
      this.queue.add(() => this.jobWrapper(job));
    }

    return job;
  }

  getJobs(types: string[] | string) {
    types = Array.isArray(types) ? types : [types];
    return this.queueMemory.filter((q) => types.includes(q.status));
  }

  getJob(id: string) {
    return this.queueMemory.find((q) => q.id === id);
  }

  // remove job from memory
  private removeJob(job: Job) {
    const fIndex = this.queueMemory.findIndex((q) => q.id === job.id);
    if (fIndex) {
      this.queueMemory.splice(fIndex, 1);
    }
  }
}
