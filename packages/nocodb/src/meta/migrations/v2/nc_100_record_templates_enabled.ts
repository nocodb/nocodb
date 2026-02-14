import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (!(await knex.schema.hasColumn(MetaTable.RECORD_TEMPLATES, 'enabled'))) {
    await knex.schema.alterTable(MetaTable.RECORD_TEMPLATES, (table) => {
      table.boolean('enabled').defaultTo(true);
    });
  }
};

const down = async (knex: Knex) => {
  if (await knex.schema.hasColumn(MetaTable.RECORD_TEMPLATES, 'enabled')) {
    await knex.schema.alterTable(MetaTable.RECORD_TEMPLATES, (table) => {
      table.dropColumn('enabled');
    });
  }
};

export { up, down };
