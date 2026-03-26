import { Injectable } from '@nestjs/common';
import { PlanLimitTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { RecordTrashService as RecordTrashServiceCE } from 'src/services/record-trash.service';
import { checkLimit, getLimit } from '~/helpers/paymentHelpers';

@Injectable()
export class RecordTrashService extends RecordTrashServiceCE {
  protected async resolveRetentionDays(context: NcContext): Promise<number> {
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

  protected async checkRestoreLimits(
    context: NcContext,
    count: number,
  ): Promise<void> {
    await checkLimit({
      workspaceId: context.workspace_id,
      type: PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
      delta: count,
    });
  }
}
