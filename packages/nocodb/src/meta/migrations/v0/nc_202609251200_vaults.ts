import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// A vault belongs to one org or one workspace, never both. Two nullable
// columns cannot express that portably, so `Vault.insert` enforces it.
// `config` holds only the provider auth parameters; secrets are never stored.
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.VAULTS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20);
    table.string('title', 255);
    table.string('provider', 40).notNullable();
    table.text('config');
    table.boolean('is_encrypted').defaultTo(false);
    table.text('meta');
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['id']);
    table.index(['fk_workspace_id'], 'nc_vaults_ws_index');
    table.index(['fk_org_id'], 'nc_vaults_org_index');
    // Named: Postgres truncates generated identifiers at 63 chars.
    table.unique(['fk_workspace_id', 'title'], {
      indexName: 'nc_vaults_ws_title_unique',
    });
    table.unique(['fk_org_id', 'title'], {
      indexName: 'nc_vaults_org_title_unique',
    });
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.VAULTS);
};

export { up, down };
