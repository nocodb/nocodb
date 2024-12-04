import { Injectable } from '@nestjs/common';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
import { AtImportProcessor } from '~/modules/jobs/jobs/at-import/at-import.processor';
import { MetaSyncProcessor } from '~/modules/jobs/jobs/meta-sync/meta-sync.processor';
import { SourceCreateProcessor } from '~/modules/jobs/jobs/source-create/source-create.processor';
import { SourceDeleteProcessor } from '~/modules/jobs/jobs/source-delete/source-delete.processor';
import { WebhookHandlerProcessor } from '~/modules/jobs/jobs/webhook-handler/webhook-handler.processor';
import { DataExportProcessor } from '~/modules/jobs/jobs/data-export/data-export.processor';
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';
import { AttachmentCleanUpProcessor } from '~/modules/jobs/jobs/attachment-clean-up/attachment-clean-up';
import { InitMigrationJobs } from '~/modules/jobs/migration-jobs/init-migration-jobs';
import { UseWorkerProcessor } from '~/modules/jobs/jobs/use-worker/use-worker.processor';
import { JobTypes } from '~/interface/Jobs';

@Injectable()
export class JobsMap {
  constructor(
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
    protected readonly useWorkerProcessor: UseWorkerProcessor,
  ) {}

  protected get _jobMap(): {
    [key in JobTypes]?: {
      this: any;
      fn?: string;
    };
  } {
    return {
      [JobTypes.DuplicateBase]: {
        this: this.duplicateProcessor,
        fn: 'duplicateBase',
      },
      [JobTypes.DuplicateModel]: {
        this: this.duplicateProcessor,
        fn: 'duplicateModel',
      },
      [JobTypes.DuplicateColumn]: {
        this: this.duplicateProcessor,
        fn: 'duplicateColumn',
      },
      [JobTypes.AtImport]: {
        this: this.atImportProcessor,
      },
      [JobTypes.MetaSync]: {
        this: this.metaSyncProcessor,
      },
      [JobTypes.SourceCreate]: {
        this: this.sourceCreateProcessor,
      },
      [JobTypes.SourceDelete]: {
        this: this.sourceDeleteProcessor,
      },
      [JobTypes.HandleWebhook]: {
        this: this.webhookHandlerProcessor,
      },
      [JobTypes.DataExport]: {
        this: this.dataExportProcessor,
      },
      [JobTypes.ThumbnailGenerator]: {
        this: this.thumbnailGeneratorProcessor,
      },
      [JobTypes.AttachmentCleanUp]: {
        this: this.attachmentCleanUpProcessor,
      },
      [JobTypes.InitMigrationJobs]: {
        this: this.initMigrationJobs,
      },
      [JobTypes.UseWorker]: {
        this: this.useWorkerProcessor,
      },
    };
  }

  public get jobs() {
    return this._jobMap;
  }
}
