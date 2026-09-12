import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.boolean('save_draft_to_browser').defaultTo(true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.dropColumn('save_draft_to_browser');
  });
};

export { up, down };
