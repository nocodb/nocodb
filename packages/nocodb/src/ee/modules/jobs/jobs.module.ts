import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import {
  JobsModule as JobsModuleCE,
  JobsModuleMetadata,
} from 'src/modules/jobs/jobs.module';
import { NocoSyncModule } from '~/integrations/sync/module/sync.module';
import { ActionExecutionProcessor } from '~/modules/jobs/jobs/action-execution.processor';
import { CleanUpController } from '~/modules/jobs/jobs/clean-up/clean-up.controller';
import { CleanUpProcessor } from '~/modules/jobs/jobs/clean-up/clean-up.processor';
import { CloudDbMigrateProcessor } from '~/modules/jobs/jobs/cloud-db-migrate.processor';
import { RemoteImportService } from '~/modules/jobs/jobs/export-import/remote-import.service';
import { HealthCheckProcessor } from '~/modules/jobs/jobs/health-check.processor';
import { ReseatSubscriptionProcessor } from '~/modules/jobs/jobs/reseat-subscription.processor';
import { SnapshotController } from '~/modules/jobs/jobs/snapshot/snapshot.controller';
import { SnapshotProcessor } from '~/modules/jobs/jobs/snapshot/snapshot.processor';
import { UpdateStatsProcessor } from '~/modules/jobs/jobs/update-stats/update-stats.processor';
import { UpdateUsageStatsProcessor } from '~/modules/jobs/jobs/update-usage-stats.processor';
import { WorkflowResumeProcessor } from '~/modules/jobs/jobs/workflow/workflow-resume.processor';
import { WorkflowScheduleProcessor } from '~/modules/jobs/jobs/workflow/workflow-schedule.processor';
import { WorkflowTestProcessor } from '~/modules/jobs/jobs/workflow/workflow-test.processor';
import { WorkflowProcessor } from '~/modules/jobs/jobs/workflow/workflow.processor';
import { WorkflowErrorNotificationProcessor } from '~/modules/jobs/jobs/workflow/workflow-error-notification.processor';
import { WorkflowDraftReminderProcessor } from '~/modules/jobs/jobs/workflow/workflow-draft-reminder.processor';
import { HookErrorNotificationProcessor } from '~/modules/jobs/jobs/hook-error-notification.processor';
import { RecordTrashCleanupJob } from '~/modules/jobs/jobs/record-trash-cleanup/record-trash-cleanup.job';
import { WorkerController } from '~/modules/jobs/worker/worker.controller';
import { PaymentModule } from '~/modules/payment/payment.module';
import { getRedisURL, NC_REDIS_TYPE } from '~/helpers/redisHelpers';
import { JOBS_QUEUE } from '~/interface/Jobs';
import { JobsService } from '~/modules/jobs/redis/jobs.service';
import { JobsProcessor } from '~/modules/jobs/jobs.processor';
import { UseWorkerProcessor } from '~/modules/jobs/jobs/use-worker/use-worker.processor';
import { NocoAiModule } from '~/integrations/ai/module/ai.module';
import { JobsController } from '~/modules/jobs/jobs.controller';
import { CACHE_PREFIX } from '~/utils/globals';

@Module({
  ...JobsModuleMetadata,
  imports: [
    ...JobsModuleMetadata.imports,
    ...(getRedisURL(NC_REDIS_TYPE.JOB)
      ? [
          BullModule.forRoot({
            url: getRedisURL(NC_REDIS_TYPE.JOB),
            ...(getRedisURL(NC_REDIS_TYPE.JOB)?.startsWith('rediss://')
              ? { redis: { tls: {} } }
              : {}),
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
    forwardRef(() => NocoSyncModule),
    forwardRef(() => PaymentModule),
    forwardRef(() => NocoAiModule),
  ],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true'
      ? JobsModuleMetadata.controllers
      : [JobsController]),
    WorkerController,
    CleanUpController,
    SnapshotController,
  ],
  providers: [
    ...JobsModuleMetadata.providers,
    ...(getRedisURL(NC_REDIS_TYPE.JOB)
      ? [{ provide: 'JobsService', useClass: JobsService }]
      : []),
    JobsProcessor,
    UseWorkerProcessor,
    UpdateStatsProcessor,
    HealthCheckProcessor,
    CleanUpProcessor,
    SnapshotProcessor,
    RemoteImportService,
    UpdateUsageStatsProcessor,
    CloudDbMigrateProcessor,
    ActionExecutionProcessor,
    ReseatSubscriptionProcessor,
    WorkflowProcessor,
    WorkflowScheduleProcessor,
    WorkflowResumeProcessor,
    WorkflowTestProcessor,
    WorkflowErrorNotificationProcessor,
    WorkflowDraftReminderProcessor,
    HookErrorNotificationProcessor,
    RecordTrashCleanupJob,
  ],
  exports: [...JobsModuleMetadata.exports, RemoteImportService],
})
export class JobsModule extends JobsModuleCE {}
