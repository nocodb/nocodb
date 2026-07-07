import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// A sandbox may run its Auth/AI integrations under a chosen environment (staging
// or a custom env), so testing in the sandbox uses staging credentials instead of
// production. NULL = production (no override), the default. This is schema-agnostic
// credential separation only — data isolation is unaffected (the sandbox already
// duplicates the internal schema). `fk_environment_id` is a SOFT id reference (a
// built-in reserved key like `staging` or a custom `env…` row id).
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SANDBOXES, (table) => {
    table.string('fk_environment_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SANDBOXES, (table) => {
    table.dropColumn('fk_environment_id');
  });
};

export { up, down };
