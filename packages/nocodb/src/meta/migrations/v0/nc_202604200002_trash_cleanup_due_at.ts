import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.timestamp('trash_cleanup_due_at').defaultTo(null);
    table.index('trash_cleanup_due_at', 'idx_nc_models_trash_cleanup_due_at');
    table.boolean('trash_disabled');
    table.integer('trash_retention_days');
  });

  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.boolean('soft_deleted').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.dropIndex(
      'trash_cleanup_due_at',
      'idx_nc_models_trash_cleanup_due_at',
    );
    table.dropColumn('trash_cleanup_due_at');
    table.dropColumn('trash_disabled');
    table.dropColumn('trash_retention_days');
  });

  await knex.schema.alterTable(MetaTable.FILE_REFERENCES, (table) => {
    table.dropColumn('soft_deleted');
  });
};

export { up, down };
