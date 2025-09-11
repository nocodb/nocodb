import type { MetaTable } from '~/utils/globals';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';

interface MigrationOptions {
  READ_BATCH_SIZE?: number;
  INSERT_BATCH_SIZE?: number;
  whereConditions?: (queryBuilder: Knex.QueryBuilder) => Knex.QueryBuilder;
  orderBy?: string | string[] | { column: string; order?: 'asc' | 'desc' }[];
  selectColumns?: string | string[];
}

/**
 * Utility function to migrate table data in batches
 */
export async function migrateTableInBatches(
  knex: Knex,
  sourceTable: keyof typeof MetaTable | string,
  targetTable: keyof typeof MetaTable | string,
  transformFn: (row: any) => any,
  logger: Logger,
  options: MigrationOptions = {},
) {
  const {
    READ_BATCH_SIZE = 1000,
    INSERT_BATCH_SIZE = 200,
    whereConditions,
    orderBy = 'id',
    selectColumns = '*',
  } = options;

  let fetchNextBatch = true;
  const insertedIds = new Set<string>();

  for (let offset = 0; fetchNextBatch; offset += READ_BATCH_SIZE) {
    // Build the base query
    let query = knex.select(selectColumns).from(sourceTable as string);

    // Apply where conditions if provided
    if (whereConditions) {
      query = whereConditions(query);
    }

    // Apply ordering and pagination
    if (Array.isArray(orderBy)) {
      orderBy.forEach((order) => {
        if (typeof order === 'string') {
          query = query.orderBy(order);
        } else {
          query = query.orderBy(order.column, order.order || 'asc');
        }
      });
    } else {
      query = query.orderBy(orderBy as string);
    }

    const rows = await query.offset(offset).limit(READ_BATCH_SIZE + 1); // +1 to check if there are more rows

    logger.log(
      `Data from ${sourceTable} fetched, batch: ${offset} - ${
        offset + READ_BATCH_SIZE
      }`,
    );

    const formattedRows = rows
      .slice(0, READ_BATCH_SIZE) // exclude the last row used for pagination check
      .filter((row) => {
        if (insertedIds.has(row.id)) {
          return false;
        }
        insertedIds.add(row.id);
        return true;
      })
      .map(transformFn);

    if (formattedRows.length > 0) {
      await knex.batchInsert(
        targetTable as string,
        formattedRows,
        INSERT_BATCH_SIZE,
      );
      logger.log(
        `Inserted ${formattedRows.length} rows from ${sourceTable} to ${targetTable}`,
      );
    }

    // check if there are more rows to fetch
    fetchNextBatch = rows.length > READ_BATCH_SIZE;
  }

  logger.log(`Data migration from ${sourceTable} to ${targetTable} completed`);
}
