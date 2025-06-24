import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DB_SERVERS, (table) => {
    table.renameColumn('max_tenants', 'max_tenant_count');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DB_SERVERS, (table) => {
    table.renameColumn('max_tenant_count', 'max_tenants');
  });
};

export { up, down };
