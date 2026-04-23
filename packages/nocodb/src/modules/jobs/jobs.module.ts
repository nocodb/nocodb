import { forwardRef, Module } from '@nestjs/common';
import { RecoverDisconnectedTableNames } from './migration-jobs/nc_job_008_recover_disconnected_table_name';
import { MigrateController } from '~/modules/jobs/jobs/export-import/migrate.controller';
import { MigrateService } from '~/modules/jobs/jobs/export-import/migrate.service';
import { NocoModule } from '~/modules/noco.module';

// Jobs
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { ImportService } from '~/modules/jobs/jobs/export-import/import.service';
import { AtImportController } from '~/modules/jobs/jobs/at-import/at-import.controller';
import { AtImportProcessor } from '~/modules/jobs/jobs/at-import/at-import.processor';
import { DuplicateController } from '~/modules/jobs/jobs/export-import/duplicate.controller';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
import { DuplicateService } from '~/modules/jobs/jobs/export-import/duplicate.service';
import { MetaSyncController } from '~/modules/jobs/jobs/meta-sync/meta-sync.controller';
import { MetaSyncProcessor } from '~/modules/jobs/jobs/meta-sync/meta-sync.processor';
import { SourceCreateController } from '~/modules/jobs/jobs/source-create/source-create.controller';
import { SourceCreateProcessor } from '~/modules/jobs/jobs/source-create/source-create.processor';
import { SourceDeleteController } from '~/modules/jobs/jobs/source-delete/source-delete.controller';
import { SourceDeleteProcessor } from '~/modules/jobs/jobs/source-delete/source-delete.processor';
import { WebhookHandlerProcessor } from '~/modules/jobs/jobs/webhook-handler/webhook-handler.processor';
import { DataExportProcessor } from '~/modules/jobs/jobs/data-export/data-export.processor';
import { DataExportController } from '~/modules/jobs/jobs/data-export/data-export.controller';
import { DataExportCleanUpProcessor } from '~/modules/jobs/jobs/data-export-clean-up/data-export-clean-up.processor';
import { PublicDataExportController } from '~/modules/jobs/jobs/data-export/public-data-export.controller';
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';
import { AttachmentCleanUpProcessor } from '~/modules/jobs/jobs/attachment-clean-up/attachment-clean-up';
import { AttachmentUrlUploadProcessor } from '~/modules/jobs/jobs/attachment-url-upload/attachment-url-upload.processor';

// Job Map
import { JobsMap } from '~/modules/jobs/jobs-map.service';

// Migration Jobs
import { InitMigrationJobs } from '~/modules/jobs/migration-jobs/init-migration-jobs';
import { AttachmentMigration } from '~/modules/jobs/migration-jobs/nc_job_001_attachment';
import { ThumbnailMigration } from '~/modules/jobs/migration-jobs/nc_job_002_thumbnail';
import { OrderColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_005_order_column';
import { RecoverOrderColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_007_recover_order_column';
import { NoOpMigration } from '~/modules/jobs/migration-jobs/nc_job_no_op';
import { AuditMigration } from '~/modules/jobs/migration-jobs/nc_job_009_audit_migration';
import { SoftDeleteColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_010_soft_delete_column';
import { NormalizeSoftDeleteSqliteMigration } from '~/modules/jobs/migration-jobs/nc_job_011_normalize_soft_delete_sqlite';

// Jobs Module Related
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { JobsController } from '~/modules/jobs/jobs.controller';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';

// Fallback Queue (CE only supports fallback queue)
import { JobsService as FallbackJobsService } from '~/modules/jobs/fallback/jobs.service';
import { QueueService as FallbackQueueService } from '~/modules/jobs/fallback/fallback-queue.service';
import { RecoverLinksMigration } from '~/modules/jobs/migration-jobs/nc_job_003_recover_links';
import { CleanupDuplicateColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_004_cleanup_duplicate_column';

export const JobsModuleMetadata = {
  imports: [forwardRef(() => NocoModule)],
  controllers: [
    JobsController,
    DuplicateController,
    MigrateController,
    AtImportController,
    MetaSyncController,
    SourceCreateController,
    SourceDeleteController,
    DataExportController,
    PublicDataExportController,
  ],
  providers: [
    JobsMap,
    JobsEventService,
    FallbackQueueService,
    {
      provide: 'JobsService',
      useClass: FallbackJobsService,
    },
    JobsLogService,
    ExportService,
    ImportService,
    DuplicateProcessor,
    DuplicateService,
    MigrateService,
    AtImportProcessor,
    MetaSyncProcessor,
    SourceCreateProcessor,
    SourceDeleteProcessor,
    WebhookHandlerProcessor,
    DataExportProcessor,
    DataExportCleanUpProcessor,
    ThumbnailGeneratorProcessor,
    AttachmentCleanUpProcessor,
    AttachmentUrlUploadProcessor,

    // Migration Jobs
    InitMigrationJobs,
    AttachmentMigration,
    ThumbnailMigration,
    RecoverLinksMigration,
    CleanupDuplicateColumnMigration,
    OrderColumnMigration,
    NoOpMigration,
    RecoverOrderColumnMigration,
    RecoverDisconnectedTableNames,
    AuditMigration,
    SoftDeleteColumnMigration,
    NormalizeSoftDeleteSqliteMigration,
  ],
  exports: ['JobsService', JobsLogService, DuplicateProcessor],
};

@Module(JobsModuleMetadata)
export class JobsModule {}
