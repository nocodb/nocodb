import { MetaTable } from '../../../utils/globals';

const up = async (knex) => {
  await knex.schema.createTable(MetaTable.NOTIFICATION, function (table) {
    table.increments('id').primary();
    table.text('body');
    table.string('type');
    table.boolean('is_read').defaultTo(false);
    table.boolean('is_deleted').defaultTo(false);
    table.string('fk_user_id', 20);

    // table.string('fk_workspace_id', 20);
    //
    //
    // table.string('base_id', 20);
    // // table.foreign('base_id').references(`${MetaTable.BASES}.id`);
    // table.string('project_id', 128);
    // table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);
    // todo: index
    // workspace_id
    // table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);

    table.timestamps(true, true);
  });
};

const down = async (knex) => {
  await knex.schema.dropTable(MetaTable.NOTIFICATION);
};

export { up, down };
