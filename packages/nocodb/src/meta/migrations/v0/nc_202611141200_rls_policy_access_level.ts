import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Access level applied to rows a policy matches:
  // 'full_access' (default, legacy behavior) | 'read_only' (visible but not writable)
  await knex.schema.alterTable(MetaTable.RLS_POLICIES, (table) => {
    table.string('access_level', 20).defaultTo('full_access');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.RLS_POLICIES, (table) => {
    table.dropColumn('access_level');
  });
};

export { up, down };
