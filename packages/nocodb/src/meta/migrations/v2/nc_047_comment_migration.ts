import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_046_comment_mentions');

const BATCH_SIZE = 5000;

const up = async (knex: Knex) => {
  try {
    logger.log('nc_047_comment_migration: Migration Started');

    const rows = await knex
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
      );

    logger.log('nc_046_comment_mentions: Data from Audit Table fetched');

    if (!rows.length) {
      logger.log(
        'nc_046_comment_mentions: No Data Found to Migrate from Audit Table',
      );
      return;
    }
    const formattedRows = rows.map((row) => ({
      id: row.id,
      row_id: row.row_id,
      comment: (row.description ?? '')
        .substring((row.description ?? '').indexOf(':') + 1)
        .trim(),
      created_by: row.user_id,
      created_by_email: row.user_email,
      source_id: row.source_id,
      base_id: row.base_id,
      fk_model_id: row.fk_model_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    logger.log('nc_046_comment_mentions: Data from Audit Table formatted');

    return knex.batchInsert(MetaTable.COMMENTS, formattedRows, BATCH_SIZE);

    logger.log(
      'nc_047_comment_migration: Data migrated from Audit Table to Comments Table',
    );
  } catch (error) {
    logger.error(
      'nc_046_comment_mentions: Error while migrating data from Audit Table',
    );
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COMMENTS);
};

export { up, down };
