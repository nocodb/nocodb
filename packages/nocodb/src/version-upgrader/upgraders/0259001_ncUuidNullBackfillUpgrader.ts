import { UITypes } from 'nocodb-sdk';
import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import { Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

// Heals UUID cells that were nulled by the now-fixed "Clear cell" bug
// (nocodb/nocodb#13588). UUID columns are DB-generated via
// gen_random_uuid() and must always hold a value — pre-fix, the grid's
// clear action could set them to NULL, breaking the unique-identifier
// contract. This runs once at boot and regenerates a UUID for every
// NULL cell in every UUID column across all PG sources.
//
// Safe to re-run (WHERE IS NULL), per-column try/catch so one failure
// doesn't abort the whole upgrader, PG-only (UUID is PG-only by design).

const logger = {
  log: (message: string) => {
    console.log(`[0259001_ncUuidNullBackfillUpgrader ${Date.now()}] ${message}`);
  },
  error: (message: string) => {
    console.error(`[0259001_ncUuidNullBackfillUpgrader ${Date.now()}] ${message}`);
  },
};

export default async function ({ ncMeta }: NcUpgraderCtx) {
  logger.log('Starting UUID NULL backfill');

  // Find every UUID column across all bases/workspaces
  const uuidColumns = await ncMeta
    .knex(MetaTable.COLUMNS)
    .where('uidt', UITypes.UUID)
    .select('id', 'fk_workspace_id', 'base_id', 'fk_model_id', 'column_name');

  if (uuidColumns.length === 0) {
    logger.log('No UUID columns found — nothing to backfill');
    return;
  }

  logger.log(`Found ${uuidColumns.length} UUID column(s)`);

  // Resolve each column to { source, table_name, column_name } and
  // group by source so each connection is opened once.
  interface BackfillTarget {
    tableName: string;
    columnName: string;
  }
  const targetsBySource = new Map<
    string,
    {
      context: { workspace_id: string; base_id: string };
      targets: BackfillTarget[];
    }
  >();

  for (const col of uuidColumns) {
    const context = {
      workspace_id: col.fk_workspace_id,
      base_id: col.base_id,
    };
    const model = await Model.get(context, col.fk_model_id, ncMeta);
    if (!model) {
      logger.log(`Skipping orphaned UUID column ${col.id} — model not found`);
      continue;
    }
    const entry = targetsBySource.get(model.source_id) ?? {
      context,
      targets: [],
    };
    entry.targets.push({
      tableName: model.table_name,
      columnName: col.column_name,
    });
    targetsBySource.set(model.source_id, entry);
  }

  for (const [sourceId, { context, targets }] of targetsBySource) {
    let source: Source | undefined;
    try {
      source = await Source.get(context, sourceId, false, ncMeta);
    } catch (e) {
      logger.error(`Failed to load source ${sourceId}: ${(e as Error).message}`);
      continue;
    }

    if (!source || source.type !== 'pg') {
      // UUID is PG-only by design; skip anything else defensively
      continue;
    }

    let knex;
    try {
      knex = await NcConnectionMgrv2.get(source);
    } catch (e) {
      logger.error(
        `Failed to open connection for source ${sourceId}: ${(e as Error).message}`,
      );
      continue;
    }

    for (const { tableName, columnName } of targets) {
      try {
        const result = await knex.raw(
          `UPDATE ?? SET ?? = gen_random_uuid() WHERE ?? IS NULL`,
          [tableName, columnName, columnName],
        );
        const affected = result?.rowCount ?? 0;
        if (affected > 0) {
          logger.log(
            `Backfilled ${affected} NULL value(s) in ${tableName}.${columnName} (source ${sourceId})`,
          );
        }
      } catch (e) {
        logger.error(
          `Failed to backfill ${tableName}.${columnName} on source ${sourceId}: ${(e as Error).message}`,
        );
      }
    }
  }

  logger.log('UUID NULL backfill completed');
}
