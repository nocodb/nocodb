import { MetaTable } from '../../../utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.NOTIFICATION, (table) => {
    table.string('id', 20).primary().notNullable();
    table.text('body');
    table.boolean('is_read').defaultTo(false);
    table.boolean('is_deleted').defaultTo(false);
    table.string('fk_user_id', 20).index();
    table.timestamps(true, true);
    table.index('created_at');
  });
};

const down = async (knex) => {
  knex.schema.dropTable(MetaTable.NOTIFICATION);
};

export { up, down };
