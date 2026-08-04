import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// The form view `email` column stores a JSON map of submission-email recipients
// (`{ "someone@x.com": true }`). varchar(255) only held a couple of addresses;
// widen it to text so a form can email many base collaborators.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.text('email').alter();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.string('email', 255).alter();
  });
};

export { up, down };
