import { Module } from '@nestjs/common';
import {
  JobsModule as JobsModuleEE,
  jobsModuleEeMetadata,
} from 'src/ee/modules/jobs/jobs.module';
import { MailDispatchProcessor } from '~/modules/jobs/mail-dispatch/mail-dispatch.processor';
import { MailOutboxRecoveryProcessor } from '~/modules/jobs/mail-outbox-recovery/mail-outbox-recovery.processor';
import { MailScannerProcessor } from '~/modules/jobs/mail-scanner/mail-scanner.processor';
import { MailLimitCheck } from '~/modules/jobs/mail-scanner/checks/limit.check';

export const jobsModuleCloudMetadata = {
  imports: [...(jobsModuleEeMetadata?.imports ?? [])],
  controllers: [...(jobsModuleEeMetadata?.controllers ?? [])],
  providers: [
    ...(jobsModuleEeMetadata?.providers ?? []),
    MailDispatchProcessor,
    MailOutboxRecoveryProcessor,
    MailLimitCheck,
    MailScannerProcessor,
  ],
  exports: [...(jobsModuleEeMetadata?.exports ?? [])],
};

@Module(jobsModuleCloudMetadata)
export class JobsModule extends JobsModuleEE {}
