import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NocoModule } from '~/modules/noco.module';

// Jobs
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { ImportService } from '~/modules/jobs/jobs/export-import/import.service';
import { AtImportController } from '~/modules/jobs/jobs/at-import/at-import.controller';
import { AtImportProcessor } from '~/modules/jobs/jobs/at-import/at-import.processor';
import { DuplicateController } from '~/modules/jobs/jobs/export-import/duplicate.controller';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
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

// Job Processor
import { JobsProcessor } from '~/modules/jobs/jobs.processor';
import { JobsMap } from '~/modules/jobs/jobs-map.service';

// Migration Jobs
import { InitMigrationJobs } from '~/modules/jobs/migration-jobs/init-migration-jobs';
import { AttachmentMigration } from '~/modules/jobs/migration-jobs/nc_job_001_attachment';
import { ThumbnailMigration } from '~/modules/jobs/migration-jobs/nc_job_002_thumbnail';

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

export const JobsModuleMetadata = {
  imports: [
    forwardRef(() => NocoModule),
    ...(process.env.NC_REDIS_JOB_URL
      ? [
          BullModule.forRoot({
            url: process.env.NC_REDIS_JOB_URL,
          }),
          BullModule.registerQueue({
            name: JOBS_QUEUE,
            defaultJobOptions: {
              removeOnComplete: true,
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
    ...(process.env.NC_REDIS_JOB_URL ? [] : [FallbackQueueService]),
    {
      provide: 'JobsService',
      useClass: process.env.NC_REDIS_JOB_URL
        ? JobsService
        : FallbackJobsService,
    },
    JobsLogService,
    JobsProcessor,
    ExportService,
    ImportService,
    DuplicateProcessor,
    AtImportProcessor,
    MetaSyncProcessor,
    SourceCreateProcessor,
    SourceDeleteProcessor,
    WebhookHandlerProcessor,
    DataExportProcessor,
    ThumbnailGeneratorProcessor,
    AttachmentCleanUpProcessor,

    // Migration Jobs
    InitMigrationJobs,
    AttachmentMigration,
    ThumbnailMigration,
  ],
  exports: ['JobsService'],
};

@Module(JobsModuleMetadata)
export class JobsModule {}
