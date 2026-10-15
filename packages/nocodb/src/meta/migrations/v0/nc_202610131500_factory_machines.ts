import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * App Factory machines: what a code project's sessions start from. A project
 * has any number of machines, one of them its default; each machine has
 * versions, one per build, and the active one is what its sessions use.
 */
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.FACTORY_MACHINES, (table) => {
    table.string('id', 20).primary();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.string('title', 255);
    table.boolean('is_default').defaultTo(false);

    table.string('created_by', 20);
    table.timestamps(true, true);

    table.index(['base_id'], 'nc_factory_machines_base_idx');
  });

  await knex.schema.createTable(MetaTable.FACTORY_MACHINE_VERSIONS, (table) => {
    table.string('id', 20).primary();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_machine_id', 20);

    // Counted per machine.
    table.integer('version');
    table.text('spec');
    // sha256 of the canonical spec, base image and catalog version: a new
    // version with the hash of a finished one of the same machine reuses it.
    table.string('spec_hash', 64);

    // building | ready | failed | cancelled
    table.string('status', 16);
    table.boolean('is_active').defaultTo(false);
    table.string('step', 16);

    // `templateId:tag` sessions are created from.
    table.string('template_ref', 255);
    table.string('build_template_id', 64);
    table.string('build_id', 64);
    table.boolean('reused').defaultTo(false);

    table.text('log');
    // Provider log entries read so far; the build log is followed from here.
    table.integer('log_offset').defaultTo(0);
    table.text('error');
    // A failed build's proposed correction: `{ summary, spec }`.
    table.text('suggestion');

    table.string('created_by', 20);
    table.timestamp('built_at');
    table.timestamps(true, true);

    table.index(
      ['fk_machine_id', 'version'],
      'nc_factory_machine_versions_machine_idx',
    );
    table.index(['base_id'], 'nc_factory_machine_versions_base_idx');
    // The per-workspace build cap.
    table.index(
      ['fk_workspace_id', 'status'],
      'nc_factory_machine_versions_ws_status_idx',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.FACTORY_MACHINE_VERSIONS);
  await knex.schema.dropTableIfExists(MetaTable.FACTORY_MACHINES);
};

export { up, down };
