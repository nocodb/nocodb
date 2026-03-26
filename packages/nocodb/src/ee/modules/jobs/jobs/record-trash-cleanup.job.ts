import { Injectable } from '@nestjs/common';
import { PlanLimitTypes } from 'nocodb-sdk';
import { RecordTrashCleanupJob as RecordTrashCleanupJobCE } from 'src/modules/jobs/jobs/record-trash-cleanup/record-trash-cleanup.job';
import type { NcContext } from '~/interface/config';
import { getLimit } from '~/helpers/paymentHelpers';

@Injectable()
export class RecordTrashCleanupJob extends RecordTrashCleanupJobCE {
  protected async resolveRetention(context: NcContext): Promise<number> {
    try {
      const { limit } = await getLimit(
        PlanLimitTypes.LIMIT_TRASH_RETENTION,
        context.workspace_id,
      );
      if (limit !== Infinity && limit > 0) return limit;
    } catch {
      // fallback below
    }
    return parseInt(process.env.NC_TRASH_RETENTION_DAYS || '30', 10);
  }
}
