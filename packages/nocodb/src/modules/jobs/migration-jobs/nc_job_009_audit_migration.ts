import { v7 as uuidv7 } from 'uuid';
import { Injectable, Logger } from '@nestjs/common';
import { AuditOperationTypes } from 'nocodb-sdk';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { DriverClient } from '~/utils/nc-config';

@Injectable()
export class AuditMigration {
  private readonly logger = new Logger(AuditMigration.name);

  async job() {
    try {
      this.logger.log('Starting audit migration job');

      const ncMeta = Noco.ncMeta;
      // Use smaller batch size for SQLite due to "too many terms in compound SELECT" issue
      // ref: https://www.sqlite.org/limits.html#max_compound_select
      const batchSize =
        ncMeta.knex.clientType() === DriverClient.SQLITE ? 100 : 1000;
      const fallbackTimestamp = new Date('2020-01-01T00:00:00.000Z').getTime();

      const haveColumn = await ncMeta.knexConnection.schema.hasColumn(
        MetaTable.AUDIT,
        'old_id',
      );

      if (!haveColumn) {
        this.logger.log('Audit table already migrated');
        return true;
      }

      // Resume from the highest legacy id already migrated. We paginate the
      // legacy table by its primary key `id` (see the batch query below), so
      // any row with id greater than this has not been processed yet.
      const lastMigratedRecord = await ncMeta
        .knexConnection(MetaTable.AUDIT)
        .whereNotNull('old_id')
        .orderBy('old_id', 'desc')
        .first();

      let lastProcessedId = lastMigratedRecord?.old_id || '';

      this.logger.log(`Starting from last migrated id: ${lastProcessedId}`);

      const totalRemainingRecords = await ncMeta.knexConnection
        .from(`${MetaTable.AUDIT}_old as old`)
        .leftJoin(`${MetaTable.AUDIT} as new`, 'old.id', 'new.old_id')
        .whereNull('new.old_id')
        .where('old.op_type', '!=', AuditOperationTypes.COMMENT)
        .where('old.id', '>', lastProcessedId)
        .count('old.id as count')
        .first();

      if (totalRemainingRecords.count === 0) {
        this.logger.log('No more records to migrate, starting cleanup');
        await this.cleanupMigration(ncMeta);
        this.logger.log('Audit migration completed successfully');
        return true;
      }

      this.logger.log(
        `Found ${totalRemainingRecords.count} records to migrate in this batch`,
      );

      let processedCount = 0;
      let totalMigratedCount = 0;
      let hasMoreRecords = true;

      while (hasMoreRecords) {
        // Keyset-paginate by the primary key `id`: `WHERE id > ? ORDER BY id`
        // is a range-seek on the existing PK index on every supported database
        // (no extra index needed, and fully portable — no row-value syntax), so
        // each batch is O(log N) instead of the full table scan + sort the
        // previous created_at-based, unindexed cursor did. That full scan per
        // batch is the cause of the days-long migration in issue #12379.
        // Processing in id order (rather than chronological) is irrelevant:
        // each row's UUIDv7 is derived from its own created_at below, not from
        // the order in which rows are copied.
        const batch = await ncMeta.knexConnection
          .select('*')
          .from(`${MetaTable.AUDIT}_old`)
          .where('id', '>', lastProcessedId)
          .orderBy('id', 'asc')
          .limit(batchSize);

        if (batch.length === 0) {
          hasMoreRecords = false;
          break;
        }

        this.logger.debug(`Processing batch of ${batch.length} records`);

        const auditRecords = [];
        const oldIds = new Set();

        for (const record of batch) {
          if (record.op_type === AuditOperationTypes.COMMENT) {
            continue;
          }

          let timestamp = fallbackTimestamp;
          if (record.created_at) {
            const createdAtDate = new Date(record.created_at);
            if (!isNaN(createdAtDate.getTime())) {
              timestamp = createdAtDate.getTime();
            }
          }

          // Generate UUIDv7 with preserved timestamp for chronological ordering
          const id = uuidv7({ msecs: timestamp });

          const newRecord = {
            id,
            user: record.user,
            ip: record.ip,
            source_id: record.source_id,
            base_id: record.base_id,
            fk_model_id: record.fk_model_id,
            row_id: record.row_id,
            op_type: record.op_type,
            op_sub_type: record.op_sub_type,
            status: record.status,
            description: record.description,
            details: record.details,
            fk_user_id: record.fk_user_id,
            fk_ref_id: record.fk_ref_id,
            fk_parent_id: null,
            fk_workspace_id: record.fk_workspace_id,
            fk_org_id: null,
            user_agent: record.user_agent,
            version: record.version,
            created_at: record.created_at,
            updated_at: record.updated_at,
            old_id: record.id,
          };

          auditRecords.push(newRecord);
          oldIds.add(record.id);
        }

        if (auditRecords.length > 0) {
          await ncMeta.knexConnection.transaction(async (trx) => {
            // Check for parallel migration conflicts
            const existingRecords = await trx(MetaTable.AUDIT)
              .whereIn('old_id', Array.from(oldIds))
              .select('old_id');

            const existingIds = new Set(existingRecords.map((r) => r.old_id));
            const newRecords = auditRecords.filter(
              (r) => !existingIds.has(r.old_id),
            );

            if (newRecords.length > 0) {
              await trx(MetaTable.AUDIT).insert(newRecords);
              totalMigratedCount += newRecords.length;
              this.logger.debug(
                `Inserted ${newRecords.length} new audit records`,
              );
            }

            if (existingIds.size > 0) {
              this.logger.debug(
                `Skipped ${existingIds.size} already migrated records`,
              );
            }
          });
        }

        // Advance the cursor to the last id in the batch.
        const lastRecord = batch[batch.length - 1];
        lastProcessedId = lastRecord.id;

        processedCount += batch.length;

        if (processedCount % 5000 === 0) {
          const progressPercentage =
            +totalRemainingRecords.count > 0
              ? ((processedCount / +totalRemainingRecords.count) * 100).toFixed(
                  1,
                )
              : 0;
          this.logger.log(
            `Migration progress: ${processedCount}/${totalRemainingRecords.count} records processed (${progressPercentage}%), ${totalMigratedCount} records migrated`,
          );
        }

        if (batch.length < batchSize) {
          hasMoreRecords = false;
        }
      }

      this.logger.log(
        `Migration batch completed. Processed ${processedCount} records, migrated ${totalMigratedCount} new records.`,
      );

      // Check completion (excluding comment records that are intentionally skipped)
      const remainingRecords = await ncMeta.knexConnection
        .from(`${MetaTable.AUDIT}_old as old`)
        .leftJoin(`${MetaTable.AUDIT} as new`, 'old.id', 'new.old_id')
        .whereNull('new.old_id')
        .where('old.op_type', '!=', AuditOperationTypes.COMMENT)
        .count('old.id as count')
        .first();

      this.logger.log(
        `Remaining unmigrated records: ${remainingRecords.count}`,
      );

      if (remainingRecords.count === 0) {
        this.logger.log('All records migrated, starting cleanup');
        await this.cleanupMigration(ncMeta);
        this.logger.log('Audit migration completed successfully');
        return true;
      }

      this.logger.log(
        'Migration batch completed, more records remain for next run',
      );
      return false;
    } catch (e) {
      this.logger.error('Error running audit migration', e.stack || e.message);
      return false;
    }
  }

  private async cleanupMigration(ncMeta) {
    try {
      this.logger.log('Starting migration cleanup');

      // TODO: skipped for this iteration, we will drop in a follow up
      // await ncMeta.knexConnection.schema.dropTable(`${MetaTable.AUDIT}_old`);
      // this.logger.log('Dropped old audit table');

      await ncMeta.knexConnection.schema.alterTable(
        MetaTable.AUDIT,
        (table) => {
          table.dropColumn('old_id');
        },
      );

      this.logger.log('Removed old_id column from audit table');
      this.logger.log('Migration cleanup completed successfully');
    } catch (e) {
      this.logger.error('Error during migration cleanup', e.stack || e.message);
      throw e;
    }
  }
}
