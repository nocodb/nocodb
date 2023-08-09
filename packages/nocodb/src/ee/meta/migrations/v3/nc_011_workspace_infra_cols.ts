import { WorkspacePlan } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.tinyint('status').unsigned().defaultTo(0);
    table.string('message', 256);
    table.string('plan', 20).defaultTo(WorkspacePlan.FREE);
    table.text('infra_meta');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.dropColumn('status');
    table.dropColumn('message');
    table.dropColumn('plan');
    table.dropColumn('infra_meta');
  });
};

export { up, down };
