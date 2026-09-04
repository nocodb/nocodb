import { isFieldTrackingLmbCol, isFieldTrackingLmtCol } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type Column from '~/models/Column';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * Junction rows for LastModifiedTime / LastModifiedBy columns tracking
 * specific fields (`meta.fields_mode === 'specific'`): one row per
 * (lmt column, tracked column) pair. Mirrors the webhook trigger-fields
 * pattern (`nc_hook_trigger_fields`) — the tracked-field id set lives in
 * dedicated rows so the meta-dependency delete cascade and import
 * id-remap can see the references.
 */
export default class LmtTrackedField {
  /** Tracked column ids of a field-tracking LMT/LMB column. */
  static async getTrackedFieldIds(
    context: NcContext,
    lmtColumnId: string,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<string[]> {
    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LMT_TRACKED_FIELDS,
      { condition: { fk_column_id: lmtColumnId } },
    );
    return rows.map((row) => row.fk_tracked_column_id);
  }

  /**
   * Hydrate `tracked_field_ids` onto field-tracking LMT/LMB columns
   * (mirrors `hook.trigger_fields`) — one batched junction read for the
   * whole column list. Used on meta-serving paths so clients see the set.
   */
  static async hydrateColumns(
    context: NcContext,
    columns: Column[],
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    const targets = (columns || []).filter(
      (c) => isFieldTrackingLmtCol(c) || isFieldTrackingLmbCol(c),
    );
    if (!targets.length) return;

    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LMT_TRACKED_FIELDS,
      {
        xcCondition: { fk_column_id: { in: targets.map((t) => t.id) } },
      },
    );
    for (const col of targets) {
      col.tracked_field_ids = rows
        .filter((r) => r.fk_column_id === col.id)
        .map((r) => r.fk_tracked_column_id);
    }
  }

  /** Replace the tracked set of a column with the given ids. */
  static async set(
    context: NcContext,
    lmtColumnId: string,
    trackedFieldIds: string[],
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LMT_TRACKED_FIELDS,
      { fk_column_id: lmtColumnId },
    );

    const deduped = [...new Set(trackedFieldIds)];
    if (deduped.length) {
      await ncMeta.bulkMetaInsert(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_LMT_TRACKED_FIELDS,
        deduped.map((trackedColumnId) => ({
          fk_column_id: lmtColumnId,
          fk_tracked_column_id: trackedColumnId,
        })),
        true,
      );
    }
  }

  /** Cleanup when a tracked column is deleted (meta-dependency handler). */
  static async deleteByTrackedColumnId(
    context: NcContext,
    trackedColumnId: string,
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LMT_TRACKED_FIELDS,
      { fk_tracked_column_id: trackedColumnId },
    );
  }

  /** Cleanup when the LMT/LMB column itself is deleted. */
  static async deleteByColumnId(
    context: NcContext,
    lmtColumnId: string,
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LMT_TRACKED_FIELDS,
      { fk_column_id: lmtColumnId },
    );
  }
}
