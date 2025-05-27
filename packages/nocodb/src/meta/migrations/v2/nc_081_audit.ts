import { v7 as uuidv7 } from 'uuid';
import { AuditOperationTypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Step 1: Rename the existing table
  await knex.schema.renameTable(MetaTable.AUDIT, `${MetaTable.AUDIT}_old`);

  // Step 2: Recreate the table with the new schema
  await knex.schema.createTable(MetaTable.AUDIT, (table) => {
    if (knex.client.config.client === 'pg') {
      table.uuid('id');
    } else {
      table.string('id', 36);
    }

    table.string('user', 255);
    table.string('ip', 255);
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.string('row_id', 255);
    table.string('op_type', 255);
    table.string('op_sub_type', 255);
    table.string('status', 255);
    table.text('description');
    table.text('details');
    table.string('fk_user_id', 20);
    table.string('fk_ref_id', 20);

    if (knex.client.config.client === 'pg') {
      table.uuid('fk_parent_id');
    } else {
      table.string('fk_parent_id', 36);
    }

    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20); // new column
    table.text('user_agent');
    table.specificType('version', 'smallint').defaultTo(0);

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.RECORD_AUDIT, (table) => {
    if (knex.client.config.client === 'pg') {
      table.uuid('id');
    } else {
      table.string('id', 36);
    }

    table.string('user', 255);
    table.string('ip', 255);
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.string('row_id', 255);
    table.string('op_type', 255);
    table.string('op_sub_type', 255);
    table.string('status', 255);
    table.text('description');
    table.text('details');
    table.string('fk_user_id', 20);
    table.string('fk_ref_id', 20);

    if (knex.client.config.client === 'pg') {
      table.uuid('fk_parent_id');
    } else {
      table.string('fk_parent_id', 36);
    }

    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20); // new column
    table.text('user_agent');
    table.specificType('version', 'smallint').defaultTo(0);

    table.timestamps(true, true);
  });

  // Step 3: Copy the data from the old table to the new tables with UUIDv7 generation
  // Records with row_id go to RECORD_AUDIT, others go to AUDIT
  // Use streaming and smaller batches for memory efficiency with millions of rows
  const batchSize = 500; // Smaller batch size for better memory management
  const fallbackTimestamp = new Date('2020-01-01T00:00:00.000Z').getTime();

  console.log('Starting audit records migration...');

  let offset = 0;
  let processedCount = 0;
  let recordAuditCount = 0;
  let auditCount = 0;
  let hasMoreRecords = true;

  while (hasMoreRecords) {
    // Fetch records in small batches with offset
    const batch = await knex
      .select('*')
      .from(`${MetaTable.AUDIT}_old`)
      .orderBy('created_at', 'asc') // Order by created_at for consistent processing
      .limit(batchSize)
      .offset(offset);

    if (batch.length === 0) {
      hasMoreRecords = false;
      break;
    }

    // Separate records based on presence of row_id
    const recordAuditRecords = [];
    const auditRecords = [];

    batch.forEach((record) => {
      if (record.op_type === AuditOperationTypes.COMMENT) {
        return;
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
        // TODO: discuss migration of fk_parent_id
        fk_parent_id: null,
        fk_workspace_id: record.fk_workspace_id,
        fk_org_id: null, // new column with NULLs
        user_agent: record.user_agent,
        version: record.version,
        created_at: record.created_at,
        updated_at: record.updated_at,
      };

      // Check if row_id is present and not null/empty
      if (record.row_id && record.row_id.trim() !== '') {
        recordAuditRecords.push(newRecord);
      } else {
        auditRecords.push(newRecord);
      }
    });

    // Insert records into appropriate tables
    if (recordAuditRecords.length > 0) {
      await knex(MetaTable.RECORD_AUDIT).insert(recordAuditRecords);
      recordAuditCount += recordAuditRecords.length;
    }

    if (auditRecords.length > 0) {
      await knex(MetaTable.AUDIT).insert(auditRecords);
      auditCount += auditRecords.length;
    }

    processedCount += batch.length;
    offset += batchSize;

    // Log progress every 10,000 records
    if (processedCount % 10000 === 0) {
      console.log(`Processed ${processedCount} audit records`);
    }

    // If we got fewer records than batch size, we're done
    if (batch.length < batchSize) {
      hasMoreRecords = false;
    }
  }

  console.log(
    `Migration completed. Processed ${processedCount} audit records total: ${recordAuditCount} to RECORD_AUDIT, ${auditCount} to AUDIT.`,
  );

  // Step 4: Drop the old table
  await knex.schema.dropTable(`${MetaTable.AUDIT}_old`);

  // Step 5: Add indexes after data migration for better performance
  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.primary(['id']);
    table.index(['fk_workspace_id', 'base_id'], 'nc_audit_v2_tenant');
  });

  await knex.schema.alterTable(MetaTable.RECORD_AUDIT, (table) => {
    table.primary(['id']);
    table.index(
      ['fk_workspace_id', 'base_id', 'fk_model_id', 'row_id'],
      'nc_record_audit_v2_tenant',
    );
  });
};

const down = async (_knex: Knex) => {
  throw new Error(
    'Down migration not implemented. Manual intervention required.',
  );
};

export { up, down };
