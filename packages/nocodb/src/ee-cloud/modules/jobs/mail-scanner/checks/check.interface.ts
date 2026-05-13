/**
 * Contract for a single mail-scanner check.
 *
 * A `MailScanner` cron tick runs every registered check in sequence. Each
 * check is responsible for finding rows that need a transactional email and
 * calling `MailService.sendMail` for each match. Idempotency is enforced by
 * the deferred path's `dedupe_key`, not by the check.
 *
 * Errors thrown from `run()` are caught and logged by the scanner — one
 * check failing must not block the next one.
 */
export interface MailScannerCheck {
  readonly name: string;
  run(): Promise<void>;
}
