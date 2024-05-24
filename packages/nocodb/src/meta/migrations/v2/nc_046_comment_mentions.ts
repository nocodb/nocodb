import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_046_comment_mentions');

const up = async (knex: Knex) => {
  await knex.schema.createTableIfNotExists(MetaTable.COMMENTS, (table) => {
    table.string('id', 20).primary();

    table.string('row_id', 255);

    table.string('comment', 3000);

    table.string('created_by', 255);

    table.string('created_by_email', 255);

    table.string('resolved_by', 255);

    table.string('resolved_by_email', 255);

    table.string('parent_comment_id', 20);

    table.string('source_id', 20);

    table.string('base_id', 128);

    table.string('fk_model_id', 20);

    table.boolean('is_deleted');

    table.index(['row_id', 'fk_model_id']);

    table.timestamps(true, true);
  });

  await knex.schema.createTableIfNotExists(
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    (table) => {
      table.string('id', 20).primary();

      table.string('row_id', 255);

      table.string('user_id', 255);

      table.string('fk_model_id', 20);

      table.string('source_id', 20);

      table.string('base_id', 128);

      table.string('preferences', 255);

      table.index(['user_id', 'row_id', 'fk_model_id']);

      table.timestamps(true, true);
    },
  );

  await knex.schema.createTableIfNotExists(
    MetaTable.COMMENTS_REACTIONS,
    (table) => {
      table.string('id', 20).primary();

      table.string('row_id', 255).index();

      table.string('comment_id', 20).index();

      table.string('source_id', 20);

      table.string('fk_modal_id', 20);

      table.string('base_id', 128);

      table.string('reaction', 255);

      table.string('created_by', 255);

      table.timestamps(true, true);
    },
  );

  logger.log('nc_046_comment_mentions: Tables Created');
  knex
    .select('*')
    .from(MetaTable.AUDIT)
    .where(`${MetaTable.AUDIT}.op_type`, 'COMMENT')
    .then(async (rows) => {
      logger.log('nc_046_comment_mentions: Data from Audit Table Selected');

      const formattedRows = await Promise.all(
        rows.map(async (row) => {
          const user = await knex
            .from(MetaTable.USERS)
            .where('email', row.user)
            .first();
          return {
            id: row.id,
            row_id: row.row_id,
            comment: row.description
              .substring(row.description.indexOf(':') + 1)
              .trim(),
            created_by: user.id,
            created_by_email: row.user,
            source_id: row.source_id,
            base_id: row.base_id,
            fk_model_id: row.fk_model_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
        }),
      );
      logger.log('nc_046_comment_mentions: Data from Audit Table Formatted');

      await knex(MetaTable.COMMENTS).insert(formattedRows);
    });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COMMENTS);

  await knex.schema.dropTable(MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE);

  await knex.schema.dropTable(MetaTable.COMMENTS_REACTIONS);
};

export { up, down };
