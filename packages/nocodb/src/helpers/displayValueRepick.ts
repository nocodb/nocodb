import { isLinksOrLTAR } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import Column from '~/models/Column';
import Model from '~/models/Model';
import View from '~/models/View';
import {
  getEligibleDisplayValueLinkIds,
  isUnfollowableChain,
  resolveDisplayValueChain,
} from '~/helpers/displayValueCycle';
import mapDefaultDisplayValue from '~/helpers/mapDefaultDisplayValue';
import { clearSingleQueryCacheForReferencingModels } from '~/helpers/singleQueryCacheInvalidator';
import { CacheScope, MetaTable } from '~/utils/globals';

/** The default display value for a table's columns; link eligibility is only worked out when none is set. */
export async function pickDefaultDisplayValue(columns: Column[]) {
  if (columns.some((c) => c.pv)) return undefined;
  return mapDefaultDisplayValue(columns, {
    eligibleLinkIds: await getEligibleDisplayValueLinkIds(columns),
  });
}

/** Picks a display value for a table that has none (after a soft delete). */
export async function repickDisplayValue(
  context: NcContext,
  modelId: string,
  ncMeta: MetaService = Noco.ncMeta,
) {
  const model = await Model.getWithInfo(context, { id: modelId }, ncMeta);
  if (!model) return;
  const columns = await model.getColumns(ncMeta);
  const picked = await pickDefaultDisplayValue(columns);
  if (picked) {
    await Model.updatePrimaryColumn(context, model.id, picked.id, ncMeta);
  }
}

/** Re-picks for each table (a table can lose several links in one operation). */
export async function repickDisplayValues(
  targets: Array<{ context: NcContext; modelId: string }>,
  ncMeta: MetaService = Noco.ncMeta,
) {
  const seen = new Set<string>();
  for (const { context, modelId } of targets) {
    const key = `${context.base_id}:${modelId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await repickDisplayValue(context, modelId, ncMeta);
  }
}

/**
 * After a restore: a column that is flagged display value keeps the flag only when the table
 * has no other one and the flag does not close a display value cycle.
 */
export async function reconcileRestoredDisplayValue(
  context: NcContext,
  columnId: string,
  ncMeta: MetaService = Noco.ncMeta,
) {
  const col = await Column.get(context, { colId: columnId }, ncMeta);
  if (!col || col.deleted) return;

  if (col.pv) {
    const model = await Model.get(context, col.fk_model_id, false, ncMeta);
    const columns = (await model?.getColumns(ncMeta)) ?? [];
    const otherPv = columns.some((c) => c.pv && c.id !== col.id);
    const cyclic =
      !otherPv &&
      isLinksOrLTAR(col) &&
      isUnfollowableChain(
        await resolveDisplayValueChain(col, {
          override: { modelId: col.fk_model_id, column: col },
        }),
      );
    if (otherPv || cyclic) {
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMNS,
        { pv: false },
        col.id,
      );
      await NocoCache.update(context, `${CacheScope.COLUMN}:${col.id}`, {
        pv: false,
      });
      if (cyclic) await repickDisplayValue(context, col.fk_model_id, ncMeta);
    }
  }

  await clearRestoredModelCaches(context, col.fk_model_id, ncMeta);
}

/** A restored column or table changes the compiled reads of its table and of its referrers. */
export async function clearRestoredModelCaches(
  context: NcContext,
  modelId: string,
  ncMeta: MetaService = Noco.ncMeta,
) {
  await View.clearSingleQueryCache(context, modelId, null, ncMeta);
  await clearSingleQueryCacheForReferencingModels(context, modelId, ncMeta);
}
