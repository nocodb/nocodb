import { MetaTable } from '../../meta.service';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.text('meta');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.dropColumns('meta');
  });
};

export { up, down };
