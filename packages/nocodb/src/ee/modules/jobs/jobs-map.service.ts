import { JobsMap as JobsMapCE } from 'src/modules/jobs/jobs-map.service';
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
import { HealthCheckProcessor } from '~/modules/jobs/jobs/health-check.processor';
import { UpdateStatsProcessor } from '~/modules/jobs/jobs/update-stats/update-stats.processor';
import { CleanUpProcessor } from '~/modules/jobs/jobs/clean-up/clean-up.processor';
import { UseWorkerProcessor } from '~/modules/jobs/jobs/use-worker/use-worker.processor';
import { SnapshotProcessor } from '~/modules/jobs/jobs/snapshot/snapshot.processor';
import { JobTypes } from '~/interface/Jobs';

@Injectable()
export class JobsMap extends JobsMapCE {
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
    // EE
    protected readonly healthCheckProcessor: HealthCheckProcessor,
    protected readonly updateStatsProcessor: UpdateStatsProcessor,
    protected readonly cleanUpProcessor: CleanUpProcessor,
  ) {
    super(
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
      useWorkerProcessor,
    );
  }

  protected _jobMap = {
    ...this._jobMap,
    [JobTypes.HealthCheck]: {
      this: this.healthCheckProcessor,
    },
    [JobTypes.UpdateModelStat]: {
      this: this.updateStatsProcessor,
      fn: 'updateModelStat',
    },
    [JobTypes.UpdateWsStat]: {
      this: this.updateStatsProcessor,
      fn: 'updateWorkspaceStat',
    },
    [JobTypes.UpdateSrcStat]: {
      this: this.updateStatsProcessor,
      fn: 'updateSourceStat',
    },
    [JobTypes.CleanUp]: {
      this: this.cleanUpProcessor,
    },
    [JobTypes.CreateSnapshot]: {
      this: SnapshotProcessor,
      fn: 'createSnapshot',
    },
    [JobTypes.RestoreSnapshot]: {
      this: SnapshotProcessor,
      fn: 'restoreSnapshot',
    },
  };
}
