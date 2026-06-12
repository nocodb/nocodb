import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * App-sync re-architecture: synced destination tables no longer pass through
 * trash, so the `suspended` mapping state is gone. Sweep any mappings that
 * were suspended under the old model (their dest table sits in trash):
 * detach the table (clear `synced`, make columns editable) and delete the
 * mapping — restoring such a table now yields a plain, regular table.
 */
const up = async (knex: Knex) => {
  await detachSuspendedMappings(knex);
  await detachSuspendedTableSyncMappings(knex);
};

async function detachSuspendedMappings(knex: Knex) {
  const suspended = await knex(MetaTable.SYNC_MAPPINGS)
    .select('id', 'fk_model_id')
    .where('status', 'suspended');

  if (!suspended.length) return;

  const modelIds = [
    ...new Set(suspended.map((m) => m.fk_model_id).filter(Boolean)),
  ];

  if (modelIds.length) {
    await knex(MetaTable.MODELS)
      .whereIn('id', modelIds)
      .update({ synced: false });

    await knex(MetaTable.COLUMNS)
      .whereIn('fk_model_id', modelIds)
      .where('readonly', true)
      .update({ readonly: false });
  }

  await knex(MetaTable.SYNC_MAPPINGS)
    .whereIn(
      'id',
      suspended.map((m) => m.id),
    )
    .delete();
}

/**
 * Same sweep for the table-sync flavour (`nc_table_sync_mappings` carries the
 * same legacy `suspended` state for dest tables that sat in trash under the
 * old model): detach the dest table and delete the mapping.
 */
async function detachSuspendedTableSyncMappings(knex: Knex) {
  const suspended = await knex(MetaTable.TABLE_SYNC_MAPPINGS)
    .select('id', 'dest_table_id', 'role', 'fk_table_sync_id')
    .where('status', 'suspended');

  if (!suspended.length) return;

  // A sync whose MAIN mapping was suspended would survive the sweep mainless
  // and error on its next run — purge it wholesale: detach ALL its dest
  // tables (shadows included) and remove the sync + every mapping row.
  const mainlessSyncIds = [
    ...new Set(
      suspended
        .filter((m) => m.role === 'main' && m.fk_table_sync_id)
        .map((m) => m.fk_table_sync_id),
    ),
  ];

  if (mainlessSyncIds.length) {
    const allMappings = await knex(MetaTable.TABLE_SYNC_MAPPINGS)
      .select('id', 'dest_table_id')
      .whereIn('fk_table_sync_id', mainlessSyncIds);

    suspended.push(
      ...allMappings.filter((m) => !suspended.some((sm) => sm.id === m.id)),
    );

    await knex(MetaTable.TABLE_SYNC_COLUMN_MAPPINGS)
      .whereIn('fk_table_sync_id', mainlessSyncIds)
      .delete();
    await knex(MetaTable.TABLE_SYNC_MAPPINGS)
      .whereIn('fk_table_sync_id', mainlessSyncIds)
      .delete();
    await knex(MetaTable.TABLE_SYNCS).whereIn('id', mainlessSyncIds).delete();
  }

  const modelIds = [
    ...new Set(suspended.map((m) => m.dest_table_id).filter(Boolean)),
  ];

  if (modelIds.length) {
    await knex(MetaTable.MODELS)
      .whereIn('id', modelIds)
      .update({ synced: false });

    await knex(MetaTable.COLUMNS)
      .whereIn('fk_model_id', modelIds)
      .where('readonly', true)
      .update({ readonly: false });
  }

  await knex(MetaTable.TABLE_SYNC_MAPPINGS)
    .whereIn(
      'id',
      suspended.map((m) => m.id),
    )
    .delete();
}

const down = async (_knex: Knex) => {
  // Data sweep — not reversible.
};

export { up, down };
