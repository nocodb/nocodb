import { JobsMap as JobsMapEE } from 'src/ee/modules/jobs/jobs-map.service';
import { Injectable } from '@nestjs/common';
import { AttachmentUrlUploadProcessor } from 'src/modules/jobs/jobs/attachment-url-upload/attachment-url-upload.processor';
import { BaseTrashCleanUpProcessor } from '~/modules/jobs/jobs/base-trash-clean-up/base-trash-clean-up.processor';
import { DataImportProcessor } from '~/modules/jobs/jobs/data-import/data-import.processor';
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
import { NoOpMigration } from '~/modules/jobs/migration-jobs/nc_job_no_op';
import { SyncModuleSyncDataProcessor } from '~/integrations/sync/module/services/sync.processor';
import { SyncModuleSyncScheduleProcessor } from '~/integrations/sync/module/services/sync-schedule.processor';
import { UpdateUsageStatsProcessor } from '~/modules/jobs/jobs/update-usage-stats.processor';
import { DataExportCleanUpProcessor } from '~/modules/jobs/jobs/data-export-clean-up/data-export-clean-up.processor';
import { CloudDbMigrateProcessor } from '~/modules/jobs/jobs/cloud-db-migrate.processor';
import { ActionExecutionProcessor } from '~/modules/jobs/jobs/action-execution.processor';
import { ReseatSubscriptionProcessor } from '~/modules/jobs/jobs/reseat-subscription.processor';
import { WorkflowProcessor } from '~/modules/jobs/jobs/workflow/workflow.processor';
import { WorkflowScheduleProcessor } from '~/modules/jobs/jobs/workflow/workflow-schedule.processor';
import { WorkflowResumeProcessor } from '~/modules/jobs/jobs/workflow/workflow-resume.processor';
import { WorkflowTestProcessor } from '~/modules/jobs/jobs/workflow/workflow-test.processor';
import { WorkflowErrorNotificationProcessor } from '~/modules/jobs/jobs/workflow/workflow-error-notification.processor';
import { WorkflowDraftReminderProcessor } from '~/modules/jobs/jobs/workflow/workflow-draft-reminder.processor';
import { HookErrorNotificationProcessor } from '~/modules/jobs/jobs/hook-error-notification.processor';
import { ChatMessageProcessor } from '~/modules/jobs/jobs/chat-message.processor';
import { ChatApprovalProcessor } from '~/modules/jobs/jobs/chat-approval.processor';
import { SandboxMergeProcessor } from '~/modules/jobs/jobs/sandbox-merge.processor';
import { ManagedAppUpdateProcessor } from '~/modules/jobs/jobs/managed-app-update/managed-app-update.processor';
import { MailDispatchProcessor } from '~/modules/jobs/mail-dispatch/mail-dispatch.processor';
import { MailOutboxRecoveryProcessor } from '~/modules/jobs/mail-outbox-recovery/mail-outbox-recovery.processor';
import { MailScannerProcessor } from '~/modules/jobs/mail-scanner/mail-scanner.processor';
import { JobTypes } from '~/interface/Jobs';

@Injectable()
export class JobsMap extends JobsMapEE {
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
    protected readonly dataExportCleanUpProcessor: DataExportCleanUpProcessor,
    protected readonly useWorkerProcessor: UseWorkerProcessor,
    protected readonly healthCheckProcessor: HealthCheckProcessor,
    protected readonly updateStatsProcessor: UpdateStatsProcessor,
    protected readonly cleanUpProcessor: CleanUpProcessor,
    protected readonly snapshotProcessor: SnapshotProcessor,
    protected readonly noOpJob: NoOpMigration,
    protected readonly syncModuleSyncDataProcessor: SyncModuleSyncDataProcessor,
    protected readonly syncModuleSyncScheduleProcessor: SyncModuleSyncScheduleProcessor,
    protected readonly updateUsageStatsProcessor: UpdateUsageStatsProcessor,
    protected readonly cloudDbMigrateProcessor: CloudDbMigrateProcessor,
    protected readonly attachmentUrlUploadProcessor: AttachmentUrlUploadProcessor,
    protected readonly baseTrashCleanUpProcessor: BaseTrashCleanUpProcessor,
    protected readonly actionExecutionProcessor: ActionExecutionProcessor,
    protected readonly reseatSubscriptionProcessor: ReseatSubscriptionProcessor,
    protected readonly workflowProcessor: WorkflowProcessor,
    protected readonly workflowScheduleProcessor: WorkflowScheduleProcessor,
    protected readonly workflowResumeProcessor: WorkflowResumeProcessor,
    protected readonly workflowTestProcessor: WorkflowTestProcessor,
    protected readonly workflowErrorNotificationProcessor: WorkflowErrorNotificationProcessor,
    protected readonly workflowDraftReminderProcessor: WorkflowDraftReminderProcessor,
    protected readonly hookErrorNotificationProcessor: HookErrorNotificationProcessor,
    protected readonly chatMessageProcessor: ChatMessageProcessor,
    protected readonly chatApprovalProcessor: ChatApprovalProcessor,
    protected readonly dataImportProcessor: DataImportProcessor,
    protected readonly sandboxMergeProcessor: SandboxMergeProcessor,
    protected readonly managedAppUpdateProcessor: ManagedAppUpdateProcessor,
    // Cloud
    protected readonly mailDispatchProcessor: MailDispatchProcessor,
    protected readonly mailOutboxRecoveryProcessor: MailOutboxRecoveryProcessor,
    protected readonly mailScannerProcessor: MailScannerProcessor,
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
      dataExportCleanUpProcessor,
      useWorkerProcessor,
      healthCheckProcessor,
      updateStatsProcessor,
      cleanUpProcessor,
      snapshotProcessor,
      noOpJob,
      syncModuleSyncDataProcessor,
      syncModuleSyncScheduleProcessor,
      updateUsageStatsProcessor,
      cloudDbMigrateProcessor,
      attachmentUrlUploadProcessor,
      baseTrashCleanUpProcessor,
      actionExecutionProcessor,
      reseatSubscriptionProcessor,
      workflowProcessor,
      workflowScheduleProcessor,
      workflowResumeProcessor,
      workflowTestProcessor,
      workflowErrorNotificationProcessor,
      workflowDraftReminderProcessor,
      hookErrorNotificationProcessor,
      chatMessageProcessor,
      chatApprovalProcessor,
      dataImportProcessor,
      sandboxMergeProcessor,
      managedAppUpdateProcessor,
    );
  }

  protected get _jobMap() {
    return {
      ...super._jobMap,
      [JobTypes.MailDispatch]: {
        this: this.mailDispatchProcessor,
      },
      [JobTypes.MailOutboxRecovery]: {
        this: this.mailOutboxRecoveryProcessor,
      },
      [JobTypes.MailScanner]: {
        this: this.mailScannerProcessor,
      },
    };
  }
}
