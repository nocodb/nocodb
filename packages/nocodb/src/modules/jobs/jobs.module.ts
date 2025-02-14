import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NocoModule } from '~/modules/noco.module';
import { getRedisURL, NC_REDIS_TYPE } from '~/helpers/redisHelpers';

// Jobs
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { ImportService } from '~/modules/jobs/jobs/export-import/import.service';
import { AtImportController } from '~/modules/jobs/jobs/at-import/at-import.controller';
import { AtImportProcessor } from '~/modules/jobs/jobs/at-import/at-import.processor';
import { DuplicateController } from '~/modules/jobs/jobs/export-import/duplicate.controller';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
import { MigrateController } from 'src/modules/jobs/jobs/export-import/migrate.controller';
import { MigrateService } from 'src/modules/jobs/jobs/export-import/migrate.service';
import { MetaSyncController } from '~/modules/jobs/jobs/meta-sync/meta-sync.controller';
import { MetaSyncProcessor } from '~/modules/jobs/jobs/meta-sync/meta-sync.processor';
import { SourceCreateController } from '~/modules/jobs/jobs/source-create/source-create.controller';
import { SourceCreateProcessor } from '~/modules/jobs/jobs/source-create/source-create.processor';
import { SourceDeleteController } from '~/modules/jobs/jobs/source-delete/source-delete.controller';
import { SourceDeleteProcessor } from '~/modules/jobs/jobs/source-delete/source-delete.processor';
import { WebhookHandlerProcessor } from '~/modules/jobs/jobs/webhook-handler/webhook-handler.processor';
import { DataExportProcessor } from '~/modules/jobs/jobs/data-export/data-export.processor';
import { DataExportController } from '~/modules/jobs/jobs/data-export/data-export.controller';
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';
import { AttachmentCleanUpProcessor } from '~/modules/jobs/jobs/attachment-clean-up/attachment-clean-up';
import { UseWorkerProcessor } from '~/modules/jobs/jobs/use-worker/use-worker.processor';

// Job Processor
import { JobsProcessor } from '~/modules/jobs/jobs.processor';
import { JobsMap } from '~/modules/jobs/jobs-map.service';

// Migration Jobs
import { InitMigrationJobs } from '~/modules/jobs/migration-jobs/init-migration-jobs';
import { AttachmentMigration } from '~/modules/jobs/migration-jobs/nc_job_001_attachment';
import { ThumbnailMigration } from '~/modules/jobs/migration-jobs/nc_job_002_thumbnail';
import { OrderColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_005_order_column';
import { RecoverOrderColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_007_recover_order_column';
import { NoOpMigration } from '~/modules/jobs/migration-jobs/nc_job_no_op';

// Jobs Module Related
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
// import { JobsGateway } from '~/modules/jobs/jobs.gateway';
import { JobsController } from '~/modules/jobs/jobs.controller';
import { JobsService } from '~/modules/jobs/redis/jobs.service';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';

// Fallback
import { JobsService as FallbackJobsService } from '~/modules/jobs/fallback/jobs.service';
import { QueueService as FallbackQueueService } from '~/modules/jobs/fallback/fallback-queue.service';
import { JOBS_QUEUE } from '~/interface/Jobs';
import { RecoverLinksMigration } from '~/modules/jobs/migration-jobs/nc_job_003_recover_links';
import { CleanupDuplicateColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_004_cleanup_duplicate_column';
import { CACHE_PREFIX } from '~/utils/globals';

export const JobsModuleMetadata = {
  imports: [
    forwardRef(() => NocoModule),
    ...(getRedisURL(NC_REDIS_TYPE.JOB)
      ? [
          BullModule.forRoot({
            url: getRedisURL(NC_REDIS_TYPE.JOB),
            prefix: CACHE_PREFIX === 'nc' ? undefined : `${CACHE_PREFIX}`,
          }),
          BullModule.registerQueue({
            name: JOBS_QUEUE,
            defaultJobOptions: {
              removeOnComplete: true,
              attempts: 1,
            },
          }),
        ]
      : []),
  ],
  controllers: [
    JobsController,
    ...(process.env.NC_WORKER_CONTAINER !== 'true'
      ? [
          DuplicateController,
          MigrateController,
          AtImportController,
          MetaSyncController,
          SourceCreateController,
          SourceDeleteController,
          DataExportController,
        ]
      : []),
  ],
  providers: [
    JobsMap,
    JobsEventService,
    ...(getRedisURL(NC_REDIS_TYPE.JOB) ? [] : [FallbackQueueService]),
    {
      provide: 'JobsService',
      useClass: getRedisURL(NC_REDIS_TYPE.JOB)
        ? JobsService
        : FallbackJobsService,
    },
    JobsLogService,
    JobsProcessor,
    ExportService,
    ImportService,
    DuplicateProcessor,
    MigrateService,
    AtImportProcessor,
    MetaSyncProcessor,
    SourceCreateProcessor,
    SourceDeleteProcessor,
    WebhookHandlerProcessor,
    DataExportProcessor,
    ThumbnailGeneratorProcessor,
    AttachmentCleanUpProcessor,
    UseWorkerProcessor,

    // Migration Jobs
    InitMigrationJobs,
    AttachmentMigration,
    ThumbnailMigration,
    RecoverLinksMigration,
    CleanupDuplicateColumnMigration,
    OrderColumnMigration,
    NoOpMigration,
    RecoverOrderColumnMigration,
  ],
  exports: ['JobsService'],
};

@Module(JobsModuleMetadata)
export class JobsModule {}
