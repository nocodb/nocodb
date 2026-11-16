import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.boolean('group_by');
    table.float('group_by_order');
    table.string('group_by_sort', 255);
    table.boolean('group_by_enabled');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.GALLERY_VIEW_COLUMNS, (table) => {
    table.dropColumn('group_by');
    table.dropColumn('group_by_order');
    table.dropColumn('group_by_sort');
    table.dropColumn('group_by_enabled');
  });
};

export { up, down };
