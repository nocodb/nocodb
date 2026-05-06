import { Injectable } from '@nestjs/common';
import { RecordTrashBackfillMigration as RecordTrashBackfillMigrationCE } from 'src/modules/jobs/migration-jobs/nc_job_012_record_trash_backfill';
import { resolveTrashRetentionDays } from '~/ee/helpers/trashHelpers';

@Injectable()
export class RecordTrashBackfillMigration extends RecordTrashBackfillMigrationCE {
  protected async resolveRetentionDays(
    workspaceId: string | undefined,
    perTableOverride: number | null | undefined,
  ): Promise<number> {
    return resolveTrashRetentionDays(
      { workspace_id: workspaceId ?? '' },
      {
        source: 'record',
        model:
          typeof perTableOverride === 'number'
            ? { trash_retention_days: perTableOverride }
            : undefined,
      },
    );
  }
}
