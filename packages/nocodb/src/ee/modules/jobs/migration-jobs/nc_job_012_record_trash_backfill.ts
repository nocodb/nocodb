import { Injectable } from '@nestjs/common';
import { PlanLimitTypes } from 'nocodb-sdk';
import { RecordTrashBackfillMigration as RecordTrashBackfillMigrationCE } from 'src/modules/jobs/migration-jobs/nc_job_012_record_trash_backfill';
import { getLimit } from '~/helpers/paymentHelpers';

@Injectable()
export class RecordTrashBackfillMigration extends RecordTrashBackfillMigrationCE {
  protected async resolveRetentionDays(
    workspaceId: string | undefined,
    perTableOverride: number | null | undefined,
  ): Promise<number> {
    if (typeof perTableOverride === 'number' && perTableOverride > 0) {
      return perTableOverride;
    }
    if (workspaceId) {
      try {
        const { limit } = await getLimit(
          PlanLimitTypes.LIMIT_TRASH_RETENTION,
          workspaceId,
        );
        if (limit && limit !== Infinity && limit > 0) {
          return limit;
        }
      } catch {
        // Workspace lookup failed (deleted, missing payment) — fall through.
      }
    }
    return super.resolveRetentionDays(workspaceId, perTableOverride);
  }
}
