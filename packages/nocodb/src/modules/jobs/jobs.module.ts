import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ExportService } from './jobs/export-import/export.service';
import { ImportService } from './jobs/export-import/import.service';
import { AtImportController } from './jobs/at-import/at-import.controller';
import { AtImportProcessor } from './jobs/at-import/at-import.processor';
import { DuplicateController } from './jobs/export-import/duplicate.controller';
import { DuplicateProcessor } from './jobs/export-import/duplicate.processor';
import { JobsLogService } from './jobs/jobs-log.service';
import { JobsGateway } from './jobs.gateway';

// Redis
import { JobsService } from './redis/jobs.service';
import { JobsRedisService } from './redis/jobs-redis.service';
import { JobsEventService } from './redis/jobs-event.service';

// Fallback
import { JobsService as FallbackJobsService } from './fallback/jobs.service';
import { QueueService as FallbackQueueService } from './fallback/fallback-queue.service';
import { JobsEventService as FallbackJobsEventService } from './fallback/jobs-event.service';
import { JOBS_QUEUE } from '~/interface/Jobs';
import { MetasModule } from '~/modules/metas/metas.module';
import { DatasModule } from '~/modules/datas/datas.module';
import { GlobalModule } from '~/modules/global/global.module';

@Module({
  imports: [
    GlobalModule,
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
    ...(process.env.NC_WORKER_CONTAINER !== 'true'
      ? [DuplicateController, AtImportController]
      : []),
  ],
  providers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [JobsGateway] : []),
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
  ],
})
export class JobsModule {}
