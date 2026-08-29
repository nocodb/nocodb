import type { Knex } from 'knex';

const TABLE = 'nc_user_comment_notifications_preference';

/**
 * The comment fan-out reads this table by (fk_model_id, row_id, preferences)
 * — none of which lead the only existing index — and the check-then-insert
 * auto-subscribe can race two rows in for the same user on one record.
 */
const up = async (knex: Knex) => {
  const dupes = await knex(TABLE)
    .select('user_id', 'row_id', 'fk_model_id')
    .count({ cnt: '*' })
    .groupBy('user_id', 'row_id', 'fk_model_id')
    .havingRaw('count(*) > 1');

  for (const dupe of dupes) {
    const rows = await knex(TABLE)
      .select('id')
      .where({
        user_id: dupe.user_id,
        row_id: dupe.row_id,
        fk_model_id: dupe.fk_model_id,
      })
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc');

    // keep the oldest — the row `get()` would already have been resolving to
    await knex(TABLE)
      .whereIn(
        'id',
        rows.slice(1).map((r) => r.id),
      )
      .del();
  }

  await knex.schema.alterTable(TABLE, (table) => {
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
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(TABLE, (table) => {
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
  });
};

export { up, down };
