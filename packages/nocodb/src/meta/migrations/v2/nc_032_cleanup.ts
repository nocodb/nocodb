// import ses from '../../v1-legacy/plugins/ses';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.TEAM_USERS);

  await knex.schema.dropTable(MetaTable.TEAMS);

  await knex.schema.dropTable(MetaTable.ORGS);
};

const down = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.ORGS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('title');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.TEAMS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('title');
    table.string('org_id', 20);
    table.foreign('org_id').references(`${MetaTable.ORGS}.id`);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.TEAM_USERS, (table) => {
    table.string('org_id', 20);
    table.foreign('org_id').references(`${MetaTable.ORGS}.id`);
    table.string('user_id', 20);
    table.foreign('user_id').references(`${MetaTable.USERS}.id`);
    table.timestamps(true, true);
  });
};

export { up, down };
