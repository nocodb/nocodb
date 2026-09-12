import { Injectable } from '@nestjs/common';

/**
 * CE no-op — store listings and environments are EE-only. The EE override does
 * the real backfill.
 */
@Injectable()
export class StoreLaneBackfillMigration {
  async job(): Promise<boolean> {
    return true;
  }
}
