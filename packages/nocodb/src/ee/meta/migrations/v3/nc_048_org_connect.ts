import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.ORG, (table) => {
    table.string('fk_db_instance_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.ORG, (table) => {
    table.dropColumn('fk_db_instance_id');
  });
};

export { up, down };
