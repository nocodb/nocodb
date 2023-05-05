import { MetaTable } from '../../meta.service';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // todo: add enum and sync existing projects
    table.string('type', 200).nullable();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropColumn('type');
  });
};

export { up, down };
