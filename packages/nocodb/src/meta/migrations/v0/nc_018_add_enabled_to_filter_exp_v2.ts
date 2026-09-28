import type { Knex } from 'knex';
import { MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn(
    MetaTableOldV2.FILTER_EXP_V2,
    'enabled',
  );
  if (!hasColumn) {
    await knex.schema.alterTable(MetaTableOldV2.FILTER_EXP_V2, (table) => {
      table.boolean('enabled').defaultTo(true);
    });
  }
};

const down = async (knex: Knex) => {
  const hasColumn = await knex.schema.hasColumn(
    MetaTableOldV2.FILTER_EXP_V2,
    'enabled',
  );
  if (hasColumn) {
    await knex.schema.alterTable(MetaTableOldV2.FILTER_EXP_V2, (table) => {
      table.dropColumn('enabled');
    });
  }
};

export { up, down };
