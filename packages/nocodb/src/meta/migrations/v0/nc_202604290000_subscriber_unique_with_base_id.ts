import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Re-scope unique index to include base_id so sandbox and master can hold
// parallel subscriber rows for the same (workflow, user) pair.
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
