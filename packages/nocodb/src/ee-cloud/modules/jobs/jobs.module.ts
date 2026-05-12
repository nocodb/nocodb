import { Module } from '@nestjs/common';
import {
  JobsModule as JobsModuleEE,
  jobsModuleEeMetadata,
} from 'src/ee/modules/jobs/jobs.module';
import { MailDispatchProcessor } from '~/modules/jobs/mail-dispatch/mail-dispatch.processor';
import { MailOutboxRecoveryProcessor } from '~/modules/jobs/mail-outbox-recovery/mail-outbox-recovery.processor';
import { MailLimitScannerProcessor } from '~/modules/jobs/mail-limit-scanner/mail-limit-scanner.processor';

export const jobsModuleCloudMetadata = {
  imports: [...(jobsModuleEeMetadata?.imports ?? [])],
  controllers: [...(jobsModuleEeMetadata?.controllers ?? [])],
  providers: [
    ...(jobsModuleEeMetadata?.providers ?? []),
    MailDispatchProcessor,
    MailOutboxRecoveryProcessor,
    MailLimitScannerProcessor,
  ],
  exports: [...(jobsModuleEeMetadata?.exports ?? [])],
};

@Module(jobsModuleCloudMetadata)
export class JobsModule extends JobsModuleEE {}
