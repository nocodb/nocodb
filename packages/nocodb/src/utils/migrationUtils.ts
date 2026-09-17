import type { MetaTable } from '~/utils/globals';
import type { Logger } from '@nestjs/common';
import type { Knex } from 'knex';

interface MigrationOptions {
  READ_BATCH_SIZE?: number;
  INSERT_BATCH_SIZE?: number;
  whereConditions?: (queryBuilder: Knex.QueryBuilder) => Knex.QueryBuilder;
  selectColumns?: string | string[];
  keyColumn?: string;
}

/**
 * Migrate table data in batches.
 *
 * Paged by key, not OFFSET: an unordered `offset/limit` walk can return rows in
 * a different order between batches, so some are never read and the migration
 * reports success having silently dropped them.
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
    selectColumns = '*',
    keyColumn = 'id',
  } = options;

  let cursor: string | number | null = null;
  let migrated = 0;

  for (;;) {
    let query = knex.select(selectColumns).from(sourceTable as string);

    if (whereConditions) {
      query = whereConditions(query);
    }
    if (cursor !== null) {
      query = query.where(keyColumn, '>', cursor);
    }

    const rows = await query.orderBy(keyColumn, 'asc').limit(READ_BATCH_SIZE);

    if (!rows.length) break;

    const last = rows[rows.length - 1][keyColumn];
    if (last === undefined || last === null) {
      // Would otherwise re-read the same page forever.
      throw new Error(
        `migrateTableInBatches: "${keyColumn}" is not present on rows of ${sourceTable} — it must be selected to page on.`,
      );
    }
    cursor = last;

    const formattedRows = rows.map(transformFn);

    if (formattedRows.length > 0) {
      // Chunked by hand: batchInsert cannot carry an onConflict.
      for (let i = 0; i < formattedRows.length; i += INSERT_BATCH_SIZE) {
        await knex(targetTable as string)
          .insert(formattedRows.slice(i, i + INSERT_BATCH_SIZE))
          .onConflict()
          .ignore();
      }
      migrated += formattedRows.length;
      logger.log(
        `Inserted ${formattedRows.length} rows from ${sourceTable} to ${targetTable}`,
      );
    }

    if (rows.length < READ_BATCH_SIZE) break;
  }

  // The counters only report what was written, so an over-tight filter would
  // otherwise read as success.
  if (whereConditions) {
    const [{ count } = { count: 0 }] = await knex(sourceTable as string).count({
      count: '*',
    });
    const total = Number(count) || 0;
    if (total > migrated) {
      logger.warn(
        `${sourceTable}: ${
          total - migrated
        } of ${total} rows were excluded by the migration filter and not copied to ${targetTable}`,
      );
    }
  }

  logger.log(
    `Data migration from ${sourceTable} to ${targetTable} completed (${migrated} rows)`,
  );
}
