import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DASHBOARDS, (table) => {
    table.string('uuid', 255).index('share_uuid_idx');
    table.string('password', 255);
    table.string('fk_custom_url_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DASHBOARDS, (table) => {
    table.dropColumn('uuid');
    table.dropColumn('password');
    table.dropColumn('fk_custom_url_id');
  });
};

export { up, down };
