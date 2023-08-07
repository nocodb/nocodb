import type { Knex } from 'knex';
import { MetaTable } from '~/ee/utils/globals';

const up = async (knex: Knex) => {
  if (!(await knex.schema.hasColumn(MetaTable.BASES, 'erd_uuid'))) {
    await knex.schema.alterTable(MetaTable.BASES, (table) => {
      table.string('erd_uuid');
    });
  }
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.BASES, (table) => {
    table.dropColumn('erd_uuid');
  });
};

export { up, down };
