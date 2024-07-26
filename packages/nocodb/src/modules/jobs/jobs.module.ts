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
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [] : []),
    JobsEventService,
    ...(process.env.NC_REDIS_JOB_URL ? [] : [FallbackQueueService]),
    {
      provide: 'JobsService',
      useClass: process.env.NC_REDIS_JOB_URL
        ? JobsService
        : FallbackJobsService,
    },
    JobsLogService,
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
  ],
  exports: ['JobsService'],
};

@Module(JobsModuleMetadata)
export class JobsModule {}
