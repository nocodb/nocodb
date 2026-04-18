import { PlanLimitTypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import { getLimit } from '~/helpers/paymentHelpers';

export async function resolveTrashRetentionDays(
  context: NcContext,
): Promise<number> {
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
