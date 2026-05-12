import { Injectable, Logger } from '@nestjs/common';
import type { MailScannerCheck } from '~/modules/jobs/mail-scanner/checks/check.interface';
import { MailLimitCheck } from '~/modules/jobs/mail-scanner/checks/limit.check';

/**
 * Unified scanner cron. Owns the schedule; the actual logic lives in
 * `MailScannerCheck` implementations. Add a new check by injecting it in
 * the constructor and pushing it into `getChecks()`.
 *
 * Failures in one check are logged and isolated — they never block the next.
 */
@Injectable()
export class MailScannerProcessor {
  private logger = new Logger(MailScannerProcessor.name);

  constructor(private readonly limitCheck: MailLimitCheck) {}

  async job() {
    this.logger.debug('MailScanner job started');

    for (const check of this.getChecks()) {
      try {
        await check.run();
      } catch (e) {
        this.logger.error(
          `MailScanner: check "${check.name}" failed`,
          (e as Error).stack,
        );
      }
    }
  }

  private getChecks(): MailScannerCheck[] {
    return [this.limitCheck];
  }
}
