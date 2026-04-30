import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.BOOKMARK_GROUPS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_user_id', 20).notNullable();
    table.string('name', 100).notNullable();
    table.float('order').defaultTo(0);
    table.timestamps(true, true);
    table.index('fk_user_id');
  });

  await knex.schema.createTable(MetaTable.BOOKMARKS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_user_id', 20).notNullable();
    table.string('fk_group_id', 20).notNullable();
    table.string('title', 255).notNullable();
    table.string('target_type', 20).notNullable();
    table.string('target_id', 128).notNullable();
    table.float('order').defaultTo(0);
    table.text('meta');
    table.timestamps(true, true);
    table.index('fk_user_id');
    table.unique(['fk_user_id', 'target_type', 'target_id']);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.BOOKMARKS);
  await knex.schema.dropTableIfExists(MetaTable.BOOKMARK_GROUPS);
};

export { up, down };
