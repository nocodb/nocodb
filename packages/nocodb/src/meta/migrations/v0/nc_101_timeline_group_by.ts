import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const hasGroupBy = await knex.schema.hasColumn(
    MetaTable.TIMELINE_VIEW_COLUMNS,
    'group_by',
  );

  if (!hasGroupBy) {
    await knex.schema.alterTable(MetaTable.TIMELINE_VIEW_COLUMNS, (table) => {
      table.boolean('group_by');
      table.float('group_by_order');
      table.string('group_by_sort', 4);
      table.string('aggregation', 20);
    });
  }
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.TIMELINE_VIEW_COLUMNS, (table) => {
    table.dropColumn('group_by');
    table.dropColumn('group_by_order');
    table.dropColumn('group_by_sort');
    table.dropColumn('aggregation');
  });
};

export { up, down };
