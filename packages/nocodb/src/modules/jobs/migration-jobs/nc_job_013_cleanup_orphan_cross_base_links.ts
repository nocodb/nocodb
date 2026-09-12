import { Injectable, Logger } from '@nestjs/common';
import debug from 'debug';
import { Column } from '~/models';
import { MetaTable } from '~/utils/globals';
import { DriverClient } from '~/utils/nc-config';
import Noco from '~/Noco';

/**
 * One-time cleanup of orphaned cross-base link columns.
 *
 * A cross-base link (its `nc_col_relations_v2` row carries
 * `fk_related_base_id` pointing at a DIFFERENT base) whose related model has
 * since been deleted/trashed leaves the owning link column — and any
 * Rollup/Lookup built on it — dangling. Reads then degrade to `NC_ERROR` and,
 * once the related table is permanently purged, fail outright. Deletes created
 * after the teardown fix are cleaned at delete time; this reaps the ones that
 * predate it.
 *
 * Strategy (single pass over the meta DB, all workspaces/bases):
 *   1. SELECT cross-base relations only — `fk_related_base_id IS NOT NULL AND
 *      fk_related_base_id <> base_id` and not already soft-deleted. Cross-base
 *      links are rare, so this is a tiny result set even though the column is
 *      unindexed (one seq scan of a bounded meta table).
 *   2. For each, resolve the related model IN ITS OWN base. Orphan = the model
 *      row is gone OR flagged deleted.
 *   3. For an orphan: delete the dependent Rollup/Lookup columns first (they
 *      reference the link via `fk_relation_column_id`), then the link column —
 *      all via `Column.delete2` in the link's own base context, which removes
 *      the column + its colOptions and busts the cache.
 *
 * Idempotent — a re-run finds zero orphans. No-op on CE (no cross-base rows).
 * Best-effort per orphan: a failure is logged and skipped, never aborting the
 * whole job.
 */
@Injectable()
export class CleanupOrphanCrossBaseLinksMigration {
  private readonly debugLog = debug(
    'nc:migration-jobs:cleanup-orphan-cross-base-links',
  );
  private readonly logger = new Logger(
    CleanupOrphanCrossBaseLinksMigration.name,
  );

  async job() {
    const ncMeta = Noco.ncMeta;

    // Cross-base links are a Postgres-only feature, so a non-PG meta DB can't
    // hold any — skip the scan entirely and mark the migration complete.
    if (ncMeta.knex.clientType() !== DriverClient.PG) {
      this.logger.log(
        `cross-base orphan link cleanup: skipped (meta db is ${ncMeta.knex.clientType()}, cross-base is pg-only)`,
      );
      return true;
    }

    // 1. Find orphaned cross-base links in a SINGLE query: cross-base relations
    //    (`fk_related_base_id` set — the codebase's own cross-base marker, see
    //    getRelContext) LEFT JOINed to their related model (in its OWN base) and
    //    to their OWNING link column. An orphan we reap = related model missing
    //    (join miss) or deleted, AND the owning link column is still LIVE.
    //
    //    The owning-column check is critical: the #9392 trash/restore lifecycle
    //    soft-deletes the owning link column (deleted=true) when its related
    //    table is trashed — that link is restore-pending and is reactivated on
    //    restore. The relation row is NOT soft-deleted by teardown, so gating on
    //    `cr.deleted` would never exclude it; we must gate on the OWNING COLUMN's
    //    deleted state. Reaping a soft-deleted link would hard-delete it
    //    (Column.delete2) and break restore (data loss). So we only reap
    //    pre-teardown residue — links whose owning column was never soft-deleted.
    //
    //    Pure-knex (leftJoin / whereNotNull / select) so it runs on any meta DB;
    //    boolean / cross-base checks run in JS to stay dialect-agnostic.
    const rows = await ncMeta
      .knexConnection({ cr: MetaTable.COL_RELATIONS })
      .leftJoin({ m: MetaTable.MODELS }, function () {
        this.on('m.id', '=', 'cr.fk_related_model_id').andOn(
          'm.base_id',
          '=',
          'cr.fk_related_base_id',
        );
      })
      .leftJoin({ oc: MetaTable.COLUMNS }, function () {
        this.on('oc.id', '=', 'cr.fk_column_id').andOn(
          'oc.base_id',
          '=',
          'cr.base_id',
        );
      })
      .whereNotNull('cr.fk_related_base_id')
      .select(
        'cr.fk_column_id',
        'cr.base_id',
        'cr.fk_workspace_id',
        'cr.fk_related_base_id',
        'cr.fk_related_model_id',
        { own_col_deleted: 'oc.deleted' },
        { related_model_id: 'm.id' },
        { related_model_deleted: 'm.deleted' },
      );

    const orphans = rows.filter(
      (r) =>
        r.fk_related_base_id !== r.base_id && // genuinely cross-base
        !r.own_col_deleted && // owning column LIVE — leave soft-deleted (restore-pending) to trash/restore
        (r.related_model_id == null || r.related_model_deleted), // related model gone/deleted
    );

    const scanned = rows.length;
    let cleaned = 0;

    for (const rel of orphans) {
      const ctx = {
        workspace_id: rel.fk_workspace_id,
        base_id: rel.base_id,
      };

      try {
        // 3a. dependent Rollup/Lookup columns reference the link via
        //     fk_relation_column_id — remove them before the link itself.
        for (const depTable of [MetaTable.COL_ROLLUP, MetaTable.COL_LOOKUP]) {
          const deps = await ncMeta.metaList2(
            rel.fk_workspace_id,
            rel.base_id,
            depTable,
            { condition: { fk_relation_column_id: rel.fk_column_id } },
          );
          for (const dep of deps) {
            if (!dep.fk_column_id) continue;
            await Column.delete2(
              ctx,
              { id: dep.fk_column_id, includeDeleted: true },
              ncMeta,
            );
          }
        }

        // 3b. the orphaned link column itself.
        await Column.delete2(
          ctx,
          { id: rel.fk_column_id, includeDeleted: true },
          ncMeta,
        );
        cleaned++;
        this.debugLog(
          `cleaned orphan link ${rel.fk_column_id} in base ${rel.base_id} -> missing ${rel.fk_related_model_id}@${rel.fk_related_base_id}`,
        );
      } catch (e) {
        this.logger.warn(
          `Skipped orphan link ${rel.fk_column_id} (base ${rel.base_id}): ${e?.message}`,
          e?.stack,
        );
      }
    }

    this.logger.log(
      `cross-base orphan link cleanup: scanned ${scanned}, cleaned ${cleaned}`,
    );
    return true;
  }
}
