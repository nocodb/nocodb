import { Knex } from 'knex';
import { MetaTable } from '../../utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COWRITER, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('fk_model_id', 20);
    table.foreign('fk_model_id').references(`${MetaTable.MODELS}.id`);
    table.text('prompt_statement');
    table.text('prompt_statement_template');
    table.text('output');
    table.text('meta');
    table.boolean('is_read').defaultTo(false);
    table.string('created_by', 20);
    table.foreign('created_by').references(`${MetaTable.USERS}.id`);
    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COWRITER);
};

export { up, down };
