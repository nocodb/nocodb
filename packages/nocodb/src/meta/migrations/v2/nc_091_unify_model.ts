import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    // nc_dashboards_v2
    table.string('created_by', 20);
    table.string('owned_by', 20);
    table.string('uuid', 255);
    table.string('password', 255);
    table.string('fk_custom_url_id', 20);

    // Indexes

    table.index('uuid');
    table.index('type');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    // Indexes
    table.dropIndex('uuid');
    table.dropIndex('type');

    // nc_dashboards_v2 columns
    table.dropColumn('created_by');
    table.dropColumn('owned_by');
    table.dropColumn('uuid');
    table.dropColumn('password');
    table.dropColumn('fk_custom_url_id');
  });
};

export { up, down };
