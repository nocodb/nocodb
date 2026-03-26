import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.timestamp('trash_cleanup_due_at').defaultTo(null);
  });

  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.boolean('soft_deleted').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.dropColumn('trash_cleanup_due_at');
  });

  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.dropColumn('soft_deleted');
  });
};

export { up, down };
