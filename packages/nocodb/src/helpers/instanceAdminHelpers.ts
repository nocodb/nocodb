import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * Calculate the number of editors (seat-consuming users) across the instance.
 * CE stub — returns a basic count of all users. EE on-prem overrides this
 * with full team-aware seat calculation.
 */
export async function calculateInstanceEditorCount(
  ncMeta = Noco.ncMeta,
): Promise<number> {
  const result = await ncMeta
    .knexConnection(MetaTable.USERS)
    .count('id as count')
    .first();
  return Number(result?.count ?? 0);
}
