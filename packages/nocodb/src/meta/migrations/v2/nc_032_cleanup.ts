// import ses from '../../v1-legacy/plugins/ses';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.TEAM_USERS_OLD);

  await knex.schema.dropTable(MetaTable.TEAMS_OLD);

  await knex.schema.dropTable(MetaTable.ORGS_OLD);
};

const down = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.ORGS_OLD, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('title');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.TEAMS_OLD, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('title');
    table.string('org_id', 20);
    table.foreign('org_id').references(`${MetaTable.ORGS_OLD}.id`);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.TEAM_USERS_OLD, (table) => {
    table.string('org_id', 20);
    table.foreign('org_id').references(`${MetaTable.ORGS_OLD}.id`);
    table.string('user_id', 20);
    table.foreign('user_id').references(`${MetaTable.USERS}.id`);
    table.timestamps(true, true);
  });
};

export { up, down };
