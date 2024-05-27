import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COMMENTS, (table) => {
    table.string('id', 20).primary();

    table.string('row_id', 255);

    table.text('comment');

    table.string('created_by', 20);

    table.string('created_by_email', 255);

    table.string('resolved_by', 20);

    table.string('resolved_by_email', 255);

    table.string('parent_comment_id', 20);

    table.string('source_id', 20);

    table.string('base_id', 128);

    table.string('fk_model_id', 20);

    table.boolean('is_deleted');

    table.index(['row_id', 'fk_model_id']);

    table.timestamps(true, true);
  });

  await knex.schema.createTable(
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    (table) => {
      table.string('id', 20).primary();

      table.string('row_id', 255);

      table.string('user_id', 20);

      table.string('fk_model_id', 20);

      table.string('source_id', 20);

      table.string('base_id', 128);

      table.string('preferences', 255);

      table.index(
        ['user_id', 'row_id', 'fk_model_id'],
        'user_comments_preference_index',
      );

      table.timestamps(true, true);
    },
  );

  await knex.schema.createTable(MetaTable.COMMENTS_REACTIONS, (table) => {
    table.string('id', 20).primary();

    table.string('row_id', 255).index();

    table.string('comment_id', 20).index();

    table.string('source_id', 20);

    table.string('fk_model_id', 20);

    table.string('base_id', 128);

    table.string('reaction', 255);

    table.string('created_by', 255);

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COMMENTS);

  await knex.schema.dropTable(MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE);

  await knex.schema.dropTable(MetaTable.COMMENTS_REACTIONS);
};

export { up, down };
