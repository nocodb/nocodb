import { Injectable, Logger } from '@nestjs/common';
import debug from 'debug';
import { UITypes } from 'nocodb-sdk';
import { Column } from '~/models';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

const TRASH_BASE_CHUNK = 500;

/**
 * One-time cleanup of link columns that lost their `nc_col_relations` row.
 *
 * A live link column without a relation row crashes every v3 read of its table
 * (`getRelatedModelInfo` → `colOptions.getRelatedTable()` on null). The trash
 * purge left these behind when a concurrent meta read re-cached a junction
 * system link as soft-deleted mid-purge, so the hm-link sweep skipped it and
 * the junction drop removed only its relation row. Other residue comes from
 * link creates that failed part-way.
 *
 * Reaps, via `Column.delete2` in the column's own base:
 *   - live Lookup/Rollup columns built on an orphaned link, then
 *   - the orphaned link column itself.
 *
 * Never touches trash-owned state:
 *   - soft-deleted columns (restore-pending — see nc_job_013's P0),
 *   - columns whose table or base is soft-deleted,
 *   - columns referenced by a pending nc_trash entry.
 *
 * Idempotent; best-effort per column.
 */
@Injectable()
export class CleanupOrphanLinkColumnsMigration {
  private readonly debugLog = debug(
    'nc:migration-jobs:cleanup-orphan-link-columns',
  );
  private readonly logger = new Logger(CleanupOrphanLinkColumnsMigration.name);

  async job() {
    const ncMeta = Noco.ncMeta;

    const rows = await ncMeta
      .knexConnection({ c: MetaTable.COLUMNS })
      .leftJoin({ r: MetaTable.COL_RELATIONS }, function () {
        this.on('r.fk_column_id', '=', 'c.id').andOn(
          'r.base_id',
          '=',
          'c.base_id',
        );
      })
      .leftJoin({ m: MetaTable.MODELS }, function () {
        this.on('m.id', '=', 'c.fk_model_id').andOn(
          'm.base_id',
          '=',
          'c.base_id',
        );
      })
      .leftJoin({ b: MetaTable.PROJECT }, 'b.id', 'c.base_id')
      .whereIn('c.uidt', [UITypes.LinkToAnotherRecord, UITypes.Links])
      .whereNull('r.id')
      .select(
        'c.id',
        'c.base_id',
        'c.fk_workspace_id',
        'c.fk_model_id',
        'c.title',
        'c.system',
        { col_deleted: 'c.deleted' },
        { model_id: 'm.id' },
        { model_deleted: 'm.deleted' },
        { base_row_id: 'b.id' },
        { base_deleted: 'b.deleted' },
      );

    const candidates = rows.filter(
      (r) =>
        !r.col_deleted &&
        r.model_id &&
        !r.model_deleted &&
        r.base_row_id &&
        !r.base_deleted,
    );

    const trashText = await this.trashTextByBase([
      ...new Set(candidates.map((r) => r.base_id)),
    ]);
    const inTrash = (baseId: string, columnId: string) =>
      !!trashText.get(baseId)?.includes(columnId);

    let cleaned = 0;
    let skippedTrash = 0;

    for (const col of candidates) {
      if (inTrash(col.base_id, col.id)) {
        skippedTrash++;
        continue;
      }

      const ctx = {
        workspace_id: col.fk_workspace_id,
        base_id: col.base_id,
      };

      try {
        for (const depTable of [MetaTable.COL_ROLLUP, MetaTable.COL_LOOKUP]) {
          const deps = await ncMeta.metaList2(
            col.fk_workspace_id,
            col.base_id,
            depTable,
            { condition: { fk_relation_column_id: col.id } },
          );
          for (const dep of deps) {
            if (!dep.fk_column_id || inTrash(col.base_id, dep.fk_column_id)) {
              continue;
            }
            const depCol = await ncMeta.metaGet2(
              col.fk_workspace_id,
              col.base_id,
              MetaTable.COLUMNS,
              dep.fk_column_id,
            );
            if (!depCol || depCol.deleted) continue;
            await Column.delete2(
              ctx,
              { id: dep.fk_column_id, includeDeleted: true },
              ncMeta,
            );
          }
        }

        await Column.delete2(ctx, { id: col.id, includeDeleted: true }, ncMeta);
        cleaned++;
        this.debugLog(
          `cleaned orphan link ${col.id} (${
            col.title
          }, system=${!!col.system}) on ${col.fk_model_id} in base ${
            col.base_id
          }`,
        );
      } catch (e) {
        this.logger.warn(
          `Skipped orphan link ${col.id} (base ${col.base_id}): ${e?.message}`,
          e?.stack,
        );
      }
    }

    this.logger.log(
      `orphan link column cleanup: found ${rows.length}, eligible ${candidates.length}, cleaned ${cleaned}, kept for trash ${skippedTrash}`,
    );
    return true;
  }

  // Trash rows name the columns they will restore or purge — in resource_id or
  // anywhere in related_items/meta — so ids are matched as text per base.
  private async trashTextByBase(
    baseIds: string[],
  ): Promise<Map<string, string>> {
    const byBase = new Map<string, string>();

    for (let i = 0; i < baseIds.length; i += TRASH_BASE_CHUNK) {
      const entries = await Noco.ncMeta
        .knexConnection(MetaTable.TRASH)
        .whereIn('base_id', baseIds.slice(i, i + TRASH_BASE_CHUNK))
        .select('base_id', 'resource_id', 'related_items', 'meta');

      for (const e of entries) {
        byBase.set(
          e.base_id,
          `${byBase.get(e.base_id) ?? ''} ${e.resource_id ?? ''} ${
            e.related_items ?? ''
          } ${e.meta ?? ''}`,
        );
      }
    }
    return byBase;
  }
}
