import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Comment-source webhooks (event = 'comment') carry extra filter config that
// has no home in the existing hook columns: the @mention filter and the
// commenter include/exclude filter. Stored as serialized JSON, mirroring how
// `notification` is persisted on the same table.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.text('comment_config');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.HOOKS, (table) => {
    table.dropColumn('comment_config');
  });
};

export { up, down };
