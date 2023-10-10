import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

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

// Jobs Module Related
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
// import { JobsGateway } from '~/modules/jobs/jobs.gateway';
import { JobsController } from '~/modules/jobs/jobs.controller';
import { JobsService } from '~/modules/jobs/redis/jobs.service';
import { JobsRedisService } from '~/modules/jobs/redis/jobs-redis.service';
import { JobsEventService } from '~/modules/jobs/redis/jobs-event.service';

// Fallback
import { JobsService as FallbackJobsService } from '~/modules/jobs/fallback/jobs.service';
import { QueueService as FallbackQueueService } from '~/modules/jobs/fallback/fallback-queue.service';
import { JobsEventService as FallbackJobsEventService } from '~/modules/jobs/fallback/jobs-event.service';
import { JOBS_QUEUE } from '~/interface/Jobs';
import { MetasModule } from '~/modules/metas/metas.module';
import { DatasModule } from '~/modules/datas/datas.module';
import { GlobalModule } from '~/modules/global/global.module';

export const JobsModuleMetadata = {
  imports: [
    forwardRef(() => GlobalModule),
    DatasModule,
    MetasModule,
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
        ]
      : []),
  ],
  providers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [] : []),
    ...(process.env.NC_REDIS_JOB_URL
      ? [JobsRedisService, JobsEventService]
      : [FallbackQueueService, FallbackJobsEventService]),
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
  ],
  exports: ['JobsService'],
};

@Module(JobsModuleMetadata)
export class JobsModule {}
