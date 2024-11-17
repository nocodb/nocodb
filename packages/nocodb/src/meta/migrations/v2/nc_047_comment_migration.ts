import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_046_comment_mentions');

const READ_BATCH_SIZE = 1000;
const INSERT_BATCH_SIZE = 200;

const up = async (knex: Knex) => {
  logger.log('Migration Started');

  let fetchNextBatch = true;

  const insertedIds = new Set<string>();

  for (let offset = 0; fetchNextBatch; offset += READ_BATCH_SIZE) {
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
      )
      .orderBy(`${MetaTable.AUDIT}.id`)
      .offset(offset)
      // increase limit by 1 to check if there are more rows
      .limit(READ_BATCH_SIZE + 1);

    logger.log(
      `Data from Audit Table fetched, batch: ${offset} - ${
        offset + READ_BATCH_SIZE
      }`,
    );

    const formattedRows = rows
      // exclude the last row since it was used to check if there are more rows
      .slice(0, READ_BATCH_SIZE)
      .filter((row) => {
        if (insertedIds.has(row.id)) {
          return false;
        }
        insertedIds.add(row.id);
        return true;
      })
      .map((row) => ({
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

    logger.log('Data from Audit Table formatted');

    await knex.batchInsert(
      MetaTable.COMMENTS,
      formattedRows,
      INSERT_BATCH_SIZE,
    );

    // check if there are more rows to fetch
    fetchNextBatch = rows.length > READ_BATCH_SIZE;
  }
  logger.log('Data migrated from Audit Table to Comments Table');
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COMMENTS);
};

export { up, down };
