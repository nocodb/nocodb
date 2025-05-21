import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex(MetaTable.NOTIFICATION).update({
    is_deleted: true,
  });
};

const down = async (_knex: Knex) => {
  // no-op
};

export { up, down };
