import { Injectable } from '@nestjs/common';
import { QueueService as QueueServiceCE } from 'src/modules/jobs/fallback/fallback-queue.service';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
import { AtImportProcessor } from '~/modules/jobs/jobs/at-import/at-import.processor';
import { MetaSyncProcessor } from '~/modules/jobs/jobs/meta-sync/meta-sync.processor';
import { SourceCreateProcessor } from '~/modules/jobs/jobs/source-create/source-create.processor';
import { SourceDeleteProcessor } from '~/modules/jobs/jobs/source-delete/source-delete.processor';
import { UpdateStatsProcessor } from '~/modules/jobs/jobs/update-stats/update-stats.processor';
import { WebhookHandlerProcessor } from '~/modules/jobs/jobs/webhook-handler/webhook-handler.processor';
import { DataExportProcessor } from '~/modules/jobs/jobs/data-export/data-export.processor';
import { CleanUpProcessor } from '~/modules/jobs/jobs/clean-up/clean-up.processor';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';
import { JobTypes } from '~/interface/Jobs';
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';
import { AttachmentCleanUpProcessor } from '~/modules/jobs/jobs/attachment-clean-up/attachment-clean-up';
import { InitMigrationJobs } from '~/modules/jobs/migration-jobs/init-migration-jobs';

export interface Job {
  id: string;
  name: string;
  status: string;
  data: any;
}

@Injectable()
export class QueueService extends QueueServiceCE {
  constructor(
    protected readonly jobsEventService: JobsEventService,
    protected readonly duplicateProcessor: DuplicateProcessor,
    protected readonly atImportProcessor: AtImportProcessor,
    protected readonly metaSyncProcessor: MetaSyncProcessor,
    protected readonly sourceCreateProcessor: SourceCreateProcessor,
    protected readonly sourceDeleteProcessor: SourceDeleteProcessor,
    protected readonly updateStatsProcessor: UpdateStatsProcessor,
    protected readonly webhookHandlerProcessor: WebhookHandlerProcessor,
    protected readonly cleanUpProcessor: CleanUpProcessor,
    protected readonly dataExportProcessor: DataExportProcessor,
    protected readonly thumbnailGeneratorProcessor: ThumbnailGeneratorProcessor,
    protected readonly attachmentCleanUpProcessor: AttachmentCleanUpProcessor,
    protected readonly initMigrationJobs: InitMigrationJobs,
  ) {
    super(
      jobsEventService,
      duplicateProcessor,
      atImportProcessor,
      metaSyncProcessor,
      sourceCreateProcessor,
      sourceDeleteProcessor,
      webhookHandlerProcessor,
      dataExportProcessor,
      thumbnailGeneratorProcessor,
      attachmentCleanUpProcessor,
      initMigrationJobs,
    );
  }

  jobMap = {
    ...this.jobMap,
    [JobTypes.UpdateModelStat]: {
      this: this.updateStatsProcessor,
      fn: this.updateStatsProcessor.updateModelStat,
    },
    [JobTypes.UpdateWsStat]: {
      this: this.updateStatsProcessor,
      fn: this.updateStatsProcessor.updateWorkspaceStat,
    },
    [JobTypes.UpdateSrcStat]: {
      this: this.updateStatsProcessor,
      fn: this.updateStatsProcessor.UpdateSrcStat,
    },
    [JobTypes.CleanUp]: {
      this: this.cleanUpProcessor,
      fn: this.cleanUpProcessor.cleanUp,
    },
  };
}
