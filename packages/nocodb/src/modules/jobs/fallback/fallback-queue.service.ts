import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import Emittery from 'emittery';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
import { AtImportProcessor } from '~/modules/jobs/jobs/at-import/at-import.processor';
import { MetaSyncProcessor } from '~/modules/jobs/jobs/meta-sync/meta-sync.processor';
import { SourceCreateProcessor } from '~/modules/jobs/jobs/source-create/source-create.processor';
import { SourceDeleteProcessor } from '~/modules/jobs/jobs/source-delete/source-delete.processor';
import { WebhookHandlerProcessor } from '~/modules/jobs/jobs/webhook-handler/webhook-handler.processor';
import { DataExportProcessor } from '~/modules/jobs/jobs/data-export/data-export.processor';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';
import { JobStatus, JobTypes, MigrationJobTypes } from '~/interface/Jobs';
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';
import { AttachmentCleanUpProcessor } from '~/modules/jobs/jobs/attachment-clean-up/attachment-clean-up';
import { InitMigrationJobs } from '~/modules/jobs/migration-jobs/init-migration-jobs';
import { AttachmentMigrationProcessor } from '~/modules/jobs/migration-jobs/nc_job_001_attachment';

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
    protected readonly duplicateProcessor: DuplicateProcessor,
    protected readonly atImportProcessor: AtImportProcessor,
    protected readonly metaSyncProcessor: MetaSyncProcessor,
    protected readonly sourceCreateProcessor: SourceCreateProcessor,
    protected readonly sourceDeleteProcessor: SourceDeleteProcessor,
    protected readonly webhookHandlerProcessor: WebhookHandlerProcessor,
    protected readonly dataExportProcessor: DataExportProcessor,
    protected readonly thumbnailGeneratorProcessor: ThumbnailGeneratorProcessor,
    protected readonly attachmentCleanUpProcessor: AttachmentCleanUpProcessor,
    protected readonly initMigrationJobs: InitMigrationJobs,
    protected readonly attachmentMigrationProcessor: AttachmentMigrationProcessor,
  ) {
    this.emitter.on(JobStatus.ACTIVE, (data: { job: Job }) => {
      const job = this.queueMemory.find((job) => job.id === data.job.id);
      job.status = JobStatus.ACTIVE;
      this.jobsEventService.onActive.apply(this.jobsEventService, [job as any]);
    });
    this.emitter.on(JobStatus.COMPLETED, (data: { job: Job; result: any }) => {
      const job = this.queueMemory.find((job) => job.id === data.job.id);
      job.status = JobStatus.COMPLETED;
      this.jobsEventService.onCompleted.apply(this.jobsEventService, [
        job,
        data.result,
      ]);
      // clear job from memory
      this.removeJob(job);
    });
    this.emitter.on(JobStatus.FAILED, (data: { job: Job; error: Error }) => {
      const job = this.queueMemory.find((job) => job.id === data.job.id);
      job.status = JobStatus.FAILED;
      this.jobsEventService.onFailed.apply(this.jobsEventService, [
        job,
        data.error,
      ]);
      // clear job from memory
      this.removeJob(job);
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
    [JobTypes.DuplicateColumn]: {
      this: this.duplicateProcessor,
      fn: this.duplicateProcessor.duplicateColumn,
    },
    [JobTypes.AtImport]: {
      this: this.atImportProcessor,
      fn: this.atImportProcessor.job,
    },
    [JobTypes.MetaSync]: {
      this: this.metaSyncProcessor,
      fn: this.metaSyncProcessor.job,
    },
    [JobTypes.SourceCreate]: {
      this: this.sourceCreateProcessor,
      fn: this.sourceCreateProcessor.job,
    },
    [JobTypes.SourceDelete]: {
      this: this.sourceDeleteProcessor,
      fn: this.sourceDeleteProcessor.job,
    },
    [JobTypes.HandleWebhook]: {
      this: this.webhookHandlerProcessor,
      fn: this.webhookHandlerProcessor.job,
    },
    [JobTypes.DataExport]: {
      this: this.dataExportProcessor,
      fn: this.dataExportProcessor.job,
    },
    [JobTypes.ThumbnailGenerator]: {
      this: this.thumbnailGeneratorProcessor,
      fn: this.thumbnailGeneratorProcessor.job,
    },
    [JobTypes.AttachmentCleanUp]: {
      this: this.attachmentCleanUpProcessor,
      fn: this.attachmentCleanUpProcessor.job,
    },
    [MigrationJobTypes.InitMigrationJobs]: {
      this: this.initMigrationJobs,
      fn: this.initMigrationJobs.job,
    },
    [MigrationJobTypes.Attachment]: {
      this: this.attachmentMigrationProcessor,
      fn: this.attachmentMigrationProcessor.job,
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

  add(name: string, data: any, opts?: { jobId?: string }) {
    const id = opts?.jobId || `${this.queueIndex++}`;
    const job = { id: `${id}`, name, status: JobStatus.WAITING, data };
    this.queueMemory.push(job);
    this.queue.add(() => this.jobWrapper(job));
    return { id, name };
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
