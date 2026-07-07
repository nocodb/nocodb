import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.ENVIRONMENTS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20);
    table.string('key', 50).notNullable();
    table.string('title', 255);
    table.text('description');
    table.string('color', 20);
    table.float('order');
    table.text('meta');
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['id']);
    table.unique(['fk_workspace_id', 'key'], {
      indexName: 'nc_environments_ws_key_unique',
    });
    table.unique(['fk_org_id', 'key'], {
      indexName: 'nc_environments_org_key_unique',
    });
    table.index(['fk_workspace_id'], 'nc_environments_ws_index');
    table.index(['fk_org_id'], 'nc_environments_org_index');
  });

  // Per-environment integration config OVERRIDES. The default/production config
  // stays in `nc_integrations_v2.config`; this
  // table holds only non-default env overrides. `config` is an encrypted JSON blob,
  // same shape/encryption as the integration's own config.
  //
  // `fk_environment_id` is a SOFT id reference (meta tables use no DB FKs). It is
  // either a built-in reserved id (`staging`) or a custom env row id (`env…`).
  // `production` NEVER appears here (its config is the integration's own), so a
  // row exists only for `staging` + custom environments. `nc_environments` itself
  // stores only CUSTOM environments — production/staging are code constants.
  await knex.schema.createTable(MetaTable.INTEGRATION_ENV_CONFIGS, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('fk_integration_id', 20).notNullable();
    table.string('fk_environment_id', 20).notNullable();
    table.text('config');
    table.boolean('is_encrypted').defaultTo(false);
    table.text('meta');
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['id']);
    table.unique(['fk_integration_id', 'fk_environment_id'], {
      indexName: 'nc_integration_env_configs_int_env_unique',
    });
    table.index(['fk_integration_id'], 'nc_integration_env_configs_int_index');
    table.index(['fk_environment_id'], 'nc_integration_env_configs_env_index');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.INTEGRATION_ENV_CONFIGS);
  await knex.schema.dropTable(MetaTable.ENVIRONMENTS);
};

export { up, down };
