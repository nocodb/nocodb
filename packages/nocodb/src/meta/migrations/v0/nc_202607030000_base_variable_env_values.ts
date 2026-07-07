import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Per-environment value OVERRIDES for base variables. The default/production
// value stays in `nc_base_variables.value`; this table holds only non-default
// environment overrides (mirrors nc_integration_env_configs for integrations).
//
// `fk_environment_id` is a SOFT id reference (meta tables use no DB FKs): the
// reserved built-in id (`staging`) or a custom env row id (`env…`). `production`
// NEVER appears here — its value is the variable's own.
//
// Variable ids are preserved across base duplication (composite (base_id, id)
// PK on nc_base_variables), so the unique constraint must include base_id —
// the same fk_variable_id legitimately exists in multiple bases.
const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.BASE_VARIABLE_ENV_VALUES, (table) => {
    table.string('id', 20).notNullable();
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('fk_variable_id', 20).notNullable();
    table.string('fk_environment_id', 20).notNullable();
    table.text('value');
    table.boolean('is_encrypted').defaultTo(false);
    table.string('created_by', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.unique(['base_id', 'fk_variable_id', 'fk_environment_id'], {
      indexName: 'nc_base_var_env_values_unique',
    });
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_base_var_env_values_base_ws_index',
    );
    table.index(['fk_environment_id'], 'nc_base_var_env_values_env_index');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.BASE_VARIABLE_ENV_VALUES);
};

export { up, down };
