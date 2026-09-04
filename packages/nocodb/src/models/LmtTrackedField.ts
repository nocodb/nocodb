import {
  DependencyTableType,
  isFieldTrackingLmbCol,
  isFieldTrackingLmtCol,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type Column from '~/models/Column';
import DependencyTracker from '~/models/DependencyTracker';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

/**
 * Tracked-field set of a LastModifiedTime / LastModifiedBy column configured
 * with `meta.fields_mode === 'specific'`.
 *
 * Stored as ordinary rows in `nc_dependency_tracker`: the LMT/LMB column is
 * the *dependent* and each tracked column is a *source*, both of type
 * `column`. Reusing that table means the set travels with a base for free —
 * it is already registered for serialization, id-remap and base-delete
 * scoping, which a bespoke junction table has to earn one list at a time.
 *
 * Column→column is currently exclusive to this feature; every other producer
 * of dependency rows uses a non-column dependent (widget, workflow, bookmark,
 * date-dependency, interface page), so scoping reads and deletes to
 * `dependent_type = column` cannot disturb them.
 */
export default class LmtTrackedField {
  private static readonly EDGE = {
    source_type: DependencyTableType.Column,
    dependent_type: DependencyTableType.Column,
  };

  /** Tracked column ids of a field-tracking LMT/LMB column. */
  static async getTrackedFieldIds(
    context: NcContext,
    lmtColumnId: string,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<string[]> {
    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DEPENDENCY_TRACKER,
      { condition: { ...this.EDGE, dependent_id: lmtColumnId } },
    );
    return rows.map((row) => row.source_id);
  }

  /**
   * Hydrate `tracked_field_ids` onto field-tracking LMT/LMB columns
   * (mirrors `hook.trigger_fields`) — one batched read for the whole column
   * list. Used on meta-serving paths so clients see the set.
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
      MetaTable.DEPENDENCY_TRACKER,
      {
        condition: this.EDGE,
        xcCondition: { dependent_id: { in: targets.map((t) => t.id) } },
      },
    );
    for (const col of targets) {
      col.tracked_field_ids = rows
        .filter((r) => r.dependent_id === col.id)
        .map((r) => r.source_id);
    }
  }

  /** Replace the tracked set of a column with the given ids. */
  static async set(
    context: NcContext,
    lmtColumnId: string,
    trackedFieldIds: string[],
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    await DependencyTracker.trackDependencies(
      context,
      DependencyTableType.Column,
      lmtColumnId,
      { columns: [...new Set(trackedFieldIds)].map((id) => ({ id })) },
      ncMeta,
    );
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
      MetaTable.DEPENDENCY_TRACKER,
      { ...this.EDGE, source_id: trackedColumnId },
    );
  }

  /** Cleanup when the LMT/LMB column itself is deleted. */
  static async deleteByColumnId(
    context: NcContext,
    lmtColumnId: string,
    ncMeta: MetaService = Noco.ncMeta,
  ) {
    await DependencyTracker.clearDependencies(
      context,
      DependencyTableType.Column,
      lmtColumnId,
      ncMeta,
    );
  }
}
