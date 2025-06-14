import debug from 'debug';
import { v7 as uuidv7 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { AuditOperationTypes } from 'nocodb-sdk';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

@Injectable()
export class AuditMigration {
  private readonly debugLog = debug('nc:migration-jobs:audit');

  async job() {
    try {
      const ncMeta = Noco.ncMeta;
      const batchSize = 1000; // Increased batch size for better performance
      const fallbackTimestamp = new Date('2020-01-01T00:00:00.000Z').getTime();

      // Get the last migrated record's created_at timestamp
      const lastMigratedRecord = await ncMeta
        .knexConnection(MetaTable.AUDIT)
        .whereNotNull('old_id')
        .orderBy('created_at', 'desc')
        .first();

      const lastMigratedTimestamp =
        lastMigratedRecord?.created_at || new Date(0);

      // Get total count of records to migrate
      const totalToMigrate = await ncMeta
        .knexConnection(`${MetaTable.AUDIT}_old`)
        .where('created_at', '<=', lastMigratedTimestamp)
        .count('* as count')
        .first();

      if (totalToMigrate.count === 0) {
        // Check if we have any records left to migrate
        const remainingRecords = await ncMeta
          .knexConnection(`${MetaTable.AUDIT}_old`)
          .count('* as count')
          .first();

        if (remainingRecords.count === 0) {
          // No more records to migrate, cleanup
          await this.cleanupMigration(ncMeta);
          return true;
        }
      }

      let processedCount = 0;
      let hasMoreRecords = true;

      while (hasMoreRecords) {
        // Fetch records in batches, starting from where we left off
        const batch = await ncMeta.knexConnection
          .select('*')
          .from(`${MetaTable.AUDIT}_old`)
          .where('created_at', '>', lastMigratedTimestamp)
          .orderBy('created_at', 'asc')
          .limit(batchSize);

        if (batch.length === 0) {
          hasMoreRecords = false;
          break;
        }

        const auditRecords = [];
        const oldIds = new Set();

        for (const record of batch) {
          if (record.op_type === AuditOperationTypes.COMMENT) {
            continue;
          }

          // Use created_at if available, otherwise use fallback timestamp
          let timestamp = fallbackTimestamp;
          if (record.created_at) {
            const createdAtDate = new Date(record.created_at);
            if (!isNaN(createdAtDate.getTime())) {
              timestamp = createdAtDate.getTime();
            }
          }

          // Generate UUIDv7 with the determined timestamp
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
          // Use a transaction for better performance and consistency
          await ncMeta.knexConnection.transaction(async (trx) => {
            // Check for any records that might have been migrated in parallel
            const existingRecords = await trx(MetaTable.AUDIT)
              .whereIn('old_id', Array.from(oldIds))
              .select('old_id');

            const existingIds = new Set(existingRecords.map((r) => r.old_id));
            const newRecords = auditRecords.filter(
              (r) => !existingIds.has(r.old_id),
            );

            if (newRecords.length > 0) {
              await trx(MetaTable.AUDIT).insert(newRecords);
            }
          });
        }

        processedCount += batch.length;

        // Log progress every 10,000 records
        if (processedCount % 10000 === 0) {
          this.debugLog(`Processed ${processedCount} audit records`);
        }

        // If we got fewer records than batch size, we're done
        if (batch.length < batchSize) {
          hasMoreRecords = false;
        }
      }

      this.debugLog(
        `Migration batch completed. Processed ${processedCount} audit records.`,
      );

      // Check if we've migrated all records from the old table
      const remainingRecords = await ncMeta
        .knexConnection(`${MetaTable.AUDIT}_old`)
        .count('* as count')
        .first();

      if (remainingRecords.count === 0) {
        await this.cleanupMigration(ncMeta);
        return true;
      }

      return false;
    } catch (e) {
      this.debugLog('Error running audit migration: ', e);
      return false;
    }
  }

  private async cleanupMigration(ncMeta) {
    try {
      // Drop the old table and remove old_id column
      await ncMeta.knexConnection.schema.dropTable(`${MetaTable.AUDIT}_old`);
      await ncMeta.knexConnection.schema.alterTable(
        MetaTable.AUDIT,
        (table) => {
          table.dropColumn('old_id');
        },
      );
      this.debugLog('Migration cleanup completed successfully');
    } catch (e) {
      this.debugLog('Error during migration cleanup: ', e);
      throw e;
    }
  }
}
