import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// nc_automation_subscribers PK is (base_id, id) but the unique index from
// nc_016 was (fk_automation_id, fk_user_id) — base_id missing. Sandbox merge
// replays createWorkflow/hookCreate against master with the same entity ids,
// so the master-side subscriber insert collided with the sandbox-side row.
// Re-scope the unique index to include base_id so each base owns its own row.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_SUBSCRIBERS, (table) => {
    table.dropUnique(
      ['fk_automation_id', 'fk_user_id'],
      'nc_automation_subscribers_unique_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.AUTOMATION_SUBSCRIBERS, (table) => {
    table.unique(['base_id', 'fk_automation_id', 'fk_user_id'], {
      indexName: 'nc_automation_subscribers_unique_idx',
    });
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUTOMATION_SUBSCRIBERS, (table) => {
    table.dropUnique(
      ['base_id', 'fk_automation_id', 'fk_user_id'],
      'nc_automation_subscribers_unique_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.AUTOMATION_SUBSCRIBERS, (table) => {
    table.unique(['fk_automation_id', 'fk_user_id'], {
      indexName: 'nc_automation_subscribers_unique_idx',
    });
  });
};

export { up, down };
