import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

//
// Enterprise Vaults — a workspace's own secrets manager (AWS Secrets Manager,
// HashiCorp Vault, Azure Key Vault, Google Secret Manager, CyberArk Conjur).
//
// One row per connected provider. `config` holds only the AUTH parameters we
// need to talk to it (role ARN + region, vault address + AppRole id, …) — never
// a customer secret. It is encrypted with the same NC_CONNECTION_ENCRYPT_KEY
// path as nc_integrations_v2.config, so an instance without the key stores it
// as plaintext JSON exactly as integrations already do.
//
// The secrets themselves are NEVER stored. An integration config field holds a
// reference string — `{{ secrets.<title>.<secretId>.<key> }}` — and the value is
// fetched from the provider at connection time.
//
// `title` doubles as that reference alias, which is why it is unique per
// workspace: two vaults sharing one alias would make every reference ambiguous.
// It is also immutable once set — the service rejects a rename, because a stored
// reference embeds the alias and nothing rewrites those rows.
//
// No `deleted` column: a vault is hard-deleted, and the service refuses the
// delete while any integration still references it. A soft-deleted vault would
// leave references resolving against a row nothing can see.
//
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.VAULTS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('title', 255);
    table.string('provider', 40).notNullable();
    table.text('config');
    table.boolean('is_encrypted').defaultTo(false);
    table.text('meta');
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['id']);
    table.index(['fk_workspace_id'], 'nc_vaults_ws_index');
    // Named explicitly — Postgres truncates a generated identifier at 63 chars,
    // and a silently shortened name is one nothing can drop by the name it
    // expects.
    table.unique(['fk_workspace_id', 'title'], {
      indexName: 'nc_vaults_ws_title_unique',
    });
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.VAULTS);
};

export { up, down };
