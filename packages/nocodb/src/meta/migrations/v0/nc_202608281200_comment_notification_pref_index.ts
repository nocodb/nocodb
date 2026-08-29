import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/**
 * The comment fan-out reads this table by (fk_model_id, row_id, preferences)
 * — none of which lead the only existing index — and the check-then-insert
 * auto-subscribe can race two rows in for the same user on one record.
 */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    (table) => {
      table.dropIndex(
        ['user_id', 'row_id', 'fk_model_id'],
        'user_comments_preference_index',
      );
      table.unique(['user_id', 'row_id', 'fk_model_id'], {
        indexName: 'user_comments_preference_unique',
      });
      table.index(
        ['fk_model_id', 'row_id', 'preferences'],
        'user_comments_preference_fanout_index',
      );
    },
  );
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    (table) => {
      table.dropIndex(
        ['fk_model_id', 'row_id', 'preferences'],
        'user_comments_preference_fanout_index',
      );
      table.dropUnique(
        ['user_id', 'row_id', 'fk_model_id'],
        'user_comments_preference_unique',
      );
      table.index(
        ['user_id', 'row_id', 'fk_model_id'],
        'user_comments_preference_index',
      );
    },
  );
};

export { up, down };
