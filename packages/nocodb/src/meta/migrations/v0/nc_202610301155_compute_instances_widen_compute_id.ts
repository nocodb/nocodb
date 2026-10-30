import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// A gateway compute id embeds the cloud's signed handle, which can pass 255 chars.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COMPUTE_INSTANCES, (table) => {
    table.string('compute_id', 512).alter();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COMPUTE_INSTANCES, (table) => {
    table.string('compute_id', 255).alter();
  });
};

export { up, down };
