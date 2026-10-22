import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * Link columns in OTHER bases whose related table is `modelId` (in
 * `context.base_id`), grouped by the base they live in. Read workspace-wide
 * via knex, since metaList2 is scoped to one base.
 */
export async function getCrossBaseInboundLinkColumns(
  context: NcContext,
  modelId: string,
  ncMeta = Noco.ncMeta,
): Promise<Map<string, Set<string>>> {
  const rows: Array<{ base_id: string; fk_column_id: string }> = await ncMeta
    .knex(MetaTable.COL_RELATIONS)
    .where('fk_workspace_id', context.workspace_id)
    .whereNot('base_id', context.base_id)
    .where('fk_related_base_id', context.base_id)
    .where('fk_related_model_id', modelId);

  const byBase = new Map<string, Set<string>>();
  for (const row of rows ?? []) {
    if (!row.base_id || !row.fk_column_id) continue;
    if (!byBase.has(row.base_id)) byBase.set(row.base_id, new Set<string>());
    byBase.get(row.base_id).add(row.fk_column_id);
  }
  return byBase;
}
