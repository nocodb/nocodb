import { WorkspacePlan } from 'nocodb-sdk';
import { MetaTable } from '../../../utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.string('plan').defaultTo(WorkspacePlan.FREE);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.dropColumn('plan');
  });
};

export { up, down };
