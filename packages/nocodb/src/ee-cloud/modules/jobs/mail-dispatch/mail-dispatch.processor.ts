import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import type { MailDispatchJobData } from '~/interface/Jobs';
import { MailService } from '~/services/mail/mail.service';

@Injectable()
export class MailDispatchProcessor {
  private logger = new Logger(MailDispatchProcessor.name);

  constructor(private readonly mailService: MailService) {}

  async job(job: Job<MailDispatchJobData>) {
    const { mailSendId } = job.data ?? ({} as MailDispatchJobData);

    if (!mailSendId) {
      this.logger.warn('MailDispatch job invoked without mailSendId');
      return;
    }

    const dispatched = await this.mailService.dispatchPending(mailSendId);

    if (!dispatched) {
      this.logger.warn(`MailDispatch: ${mailSendId} not dispatched`);
    }
  }
}
