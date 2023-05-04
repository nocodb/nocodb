import { MetaTable } from '../../meta.service';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.string('display_name');
    table.string('user_name');
    table.string('bio');
    table.string('location');
    table.string('website');
    table.string('avatar');
    table.dropColumn('firstname');
    table.dropColumn('lastname');
    table.dropColumn('username');
  });

  await knex.schema.createTable(MetaTable.FOLLOWER, (table) => {
    table.string('fk_user_id', 20);
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);
    table.string('fk_follower_id', 20);
    table.foreign('fk_follower_id').references(`${MetaTable.USERS}.id`);
    table.primary(['fk_user_id', 'fk_follower_id']);
    table.index(['fk_user_id', 'fk_follower_id']);
    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumn('display_name');
    table.dropColumn('user_name');
    table.dropColumn('bio');
    table.dropColumn('location');
    table.dropColumn('website');
    table.dropColumn('avatar');
    table.string('firstname');
    table.string('lastname');
    table.string('username');
  });

  await knex.schema.dropTable(MetaTable.FOLLOWER);
};

export { up, down };
