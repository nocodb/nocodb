import { Injectable } from '@nestjs/common';

/**
 * CE no-op — credits are EE-only. The EE override does the real backfill.
 */
@Injectable()
export class CreditPlanBackfillMigration {
  async job(): Promise<boolean> {
    return true;
  }
}
