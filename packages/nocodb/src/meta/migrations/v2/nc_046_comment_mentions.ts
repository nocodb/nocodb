import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_046_comment_mentions');

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COMMENTS, (table) => {
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

  await knex.schema.createTable(
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

  await knex.schema.createTable(MetaTable.COMMENTS_REACTIONS, (table) => {
    table.string('id', 20).primary();

    table.string('row_id', 255).index();

    table.string('comment_id', 20).index();

    table.string('source_id', 20);

    table.string('fk_modal_id', 20);

    table.string('base_id', 128);

    table.string('reaction', 255);

    table.string('created_by', 255);

    table.timestamps(true, true);
  });

  logger.log('nc_046_comment_mentions: Tables Created');

  knex
    .select(
      `${MetaTable.AUDIT}.id`,
      `${MetaTable.AUDIT}.row_id`,
      `${MetaTable.AUDIT}.description`,
      `${MetaTable.AUDIT}.user as user_email`,
      `${MetaTable.AUDIT}.source_id`,
      `${MetaTable.AUDIT}.base_id`,
      `${MetaTable.AUDIT}.fk_model_id`,
      `${MetaTable.AUDIT}.created_at`,
      `${MetaTable.AUDIT}.updated_at`,
      `${MetaTable.USERS}.id as user_id`,
    )
    .from(MetaTable.AUDIT)
    .where(`${MetaTable.AUDIT}.op_type`, 'COMMENT')
    .leftJoin(
      MetaTable.USERS,
      `${MetaTable.AUDIT}.user`,
      `${MetaTable.USERS}.email`,
    )
    .then(async (rows) => {
      if (!rows.length) return;

      logger.log('nc_046_comment_mentions: Data from Audit Table Selected');

      const formattedRows = rows.map((row) => ({
        id: row.id,
        row_id: row.row_id,
        comment: row.description
          .substring(row.description.indexOf(':') + 1)
          .trim(),
        created_by: row.user_id,
        created_by_email: row.user_email,
        source_id: row.source_id,
        base_id: row.base_id,
        fk_model_id: row.fk_model_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      logger.log('nc_046_comment_mentions: Data from Audit Table Formatted');

      await knex(MetaTable.COMMENTS).insert(formattedRows);

      logger.log('nc_046_comment_mentions: Data from Audit Table Migrated');
    });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COMMENTS);

  await knex.schema.dropTable(MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE);

  await knex.schema.dropTable(MetaTable.COMMENTS_REACTIONS);
};

export { up, down };
