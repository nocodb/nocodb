import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.INTEGRATIONS_STORE, (table) => {
    table.string('id', 20).primary();
    table.string('fk_integration_id', 20).index();
    table.string('type', 20);
    table.string('sub_type', 20);
    table.string('fk_workspace_id', 20);
    table.string('fk_user_id', 20);
    table.timestamps(true, true);

    table.text('slot_0');
    table.text('slot_1');
    table.text('slot_2');
    table.text('slot_3');
    table.text('slot_4');
    table.integer('slot_5');
    table.integer('slot_6');
    table.integer('slot_7');
    table.integer('slot_8');
    table.integer('slot_9');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.INTEGRATIONS_STORE);
};

export { up, down };
