import { Injectable } from '@nestjs/common';
import { UITypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type CustomKnex from '~/db/CustomKnex';
import type { Column } from '~/models';
import { Source } from '~/models';
import { normalizeValueForUniqueCheck } from '~/helpers/uniqueConstraintHelpers';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Injectable()
export class DuplicateDetectionService {
  /**
   * Checks for duplicate non-empty values in a column
   * @param context - NocoDB context
   * @param column - Column to check
   * @param excludeRowId - Row ID to exclude from duplicate check (for updates)
   * @returns object with hasDuplicates flag and count
   */
  async checkForDuplicates(
    context: NcContext,
    column: Column,
    excludeRowId?: string | number,
  ): Promise<{ hasDuplicates: boolean; count: number }> {
    const model = await column.getModel(context);
    const source = await Source.get(context, model.source_id);
    const knex: CustomKnex = await NcConnectionMgrv2.get(source);

    // Get schema-qualified table name
    let tableName = model.table_name;
    if (source.type === 'pg') {
      // For PostgreSQL, include schema if available
      let schema: string;
      if (source?.isMeta?.(true, 1)) {
        schema = source.getConfig()?.schema;
      } else {
        schema = source.getConfig()?.searchPath?.[0];
      }
      if (schema) {
        tableName = `${schema}.${tableName}`;
      }
    } else if (source.type === 'snowflake') {
      // For Snowflake, include database and schema
      const config = source.getConfig()?.connection || source.getConfig();
      if (config?.database && config?.schema) {
        tableName = `${config.database}.${config.schema}.${tableName}`;
      }
    }

    const columnName = column.column_name;
    const primaryKey = model.primaryKey;

    // If excludeRowId is provided but no primary key exists, we can't exclude a specific row
    if (excludeRowId && !primaryKey) {
      throw NcError.get(context).internalServerError(
        'Cannot exclude row: Primary key not found. Tables without primary keys cannot use row exclusion in duplicate checks.',
      );
    }

    // Use GROUP BY with COUNT to find duplicates directly in the database
    // This is much more efficient than fetching all records
    // Limit to 1 for existence check - we just need to know if any duplicates exist
    let query = knex(tableName)
      .select(columnName)
      .count('* as count')
      .whereNotNull(columnName)
      .groupBy(columnName)
      .havingRaw('COUNT(*) > 1')
      .limit(1); // Limit to 1 to avoid fetching all duplicates

    // Exclude specific row if provided (for update operations)
    if (excludeRowId && primaryKey) {
      query = knex(tableName)
        .select(columnName)
        .count('* as count')
        .whereNotNull(columnName)
        .where(primaryKey.column_name, '!=', excludeRowId)
        .groupBy(columnName)
        .havingRaw('COUNT(*) > 1')
        .limit(1);
    }

    const results = await query;
    const hasDuplicates = results.length > 0;

    // For count, use a simpler approach: total rows minus distinct values
    // This gives us the number of duplicate rows
    let duplicateCount = 0;
    if (hasDuplicates) {
      // Count total non-null, non-empty rows
      const totalQuery = knex(tableName)
        .count('* as total')
        .whereNotNull(columnName);

      // Count distinct non-null, non-empty values
      const distinctQuery = knex(tableName)
        .select(knex.raw(`COUNT(DISTINCT ??) as distinct_count`, [columnName]))
        .whereNotNull(columnName);

      // Apply excludeRowId if provided
      if (excludeRowId && primaryKey) {
        totalQuery.where(primaryKey.column_name, '!=', excludeRowId);
        distinctQuery.where(primaryKey.column_name, '!=', excludeRowId);
      }

      const [totalResult, distinctResult] = await Promise.all([
        totalQuery.first(),
        distinctQuery.first(),
      ]);

      const total = parseInt(String((totalResult as any)?.total || '0'), 10);
      const distinct = parseInt(
        String((distinctResult as any)?.distinct_count || '0'),
        10,
      );

      // Duplicate count = total rows - distinct values
      // (each distinct value should appear once, so extra rows are duplicates)
      duplicateCount = total - distinct;
    }

    return {
      hasDuplicates,
      count: duplicateCount,
    };
  }

  // keeping this function for future reference(bulk op or non-pg dbs), at the moment it's not used anywhere
  /**
   * Validates that a value doesn't violate unique constraint
   * @param context - NocoDB context
   * @param column - Column with unique constraint
   * @param value - Value to validate
   * @param excludeRowId - Row ID to exclude from duplicate check (for updates)
   * @returns true if value is unique
   */
  async validateUniqueValue(
    context: NcContext,
    column: Column,
    value: any,
    excludeRowId?: string | number,
  ): Promise<boolean> {
    // Allow empty values (null, undefined, empty string)
    if (value === null || value === undefined || value === '') {
      return true;
    }

    const model = await column.getModel(context);
    const source = await Source.get(context, model.source_id);
    const knex: CustomKnex = await NcConnectionMgrv2.get(source);

    // Get schema-qualified table name
    let tableName = model.table_name;
    if (source.type === 'pg') {
      // For PostgreSQL, include schema if available
      let schema: string;
      if (source?.isMeta?.(true, 1)) {
        schema = source.getConfig()?.schema;
      } else {
        schema = source.getConfig()?.searchPath?.[0];
      }
      if (schema) {
        tableName = `${schema}.${tableName}`;
      }
    } else if (source.type === 'snowflake') {
      // For Snowflake, include database and schema
      const config = source.getConfig()?.connection || source.getConfig();
      if (config?.database && config?.schema) {
        tableName = `${config.database}.${config.schema}.${tableName}`;
      }
    }

    const columnName = column.column_name;
    const primaryKey = model.primaryKey;

    // If excludeRowId is provided but no primary key exists, we can't exclude a specific row
    if (excludeRowId && !primaryKey) {
      throw NcError.get(context).internalServerError(
        'Cannot exclude row: Primary key not found. Tables without primary keys cannot use row exclusion in unique value validation.',
      );
    }

    const normalizedValue = normalizeValueForUniqueCheck(value, column.uidt);

    if (normalizedValue === null) {
      return true; // Empty values are always allowed
    }

    let query = knex(tableName).count('* as count');

    // Build query based on field type
    if (
      [
        UITypes.SingleLineText,
        UITypes.LongText,
        UITypes.Email,
        UITypes.PhoneNumber,
        UITypes.URL,
      ].includes(column.uidt)
    ) {
      // Exact comparison for text fields
      query = query.where(columnName, String(value));
    } else {
      // Exact comparison for other types
      query = query.where(columnName, value);
    }

    if (excludeRowId && primaryKey) {
      query = query.where(primaryKey.column_name, '!=', excludeRowId);
    }

    const result = await query.first();
    const count = parseInt(String(result?.count || '0'), 10);

    return count === 0;
  }

  /**
   * Gets list of duplicate values for a column (useful for error reporting)
   * @param context - NocoDB context
   * @param column - Column to check
   * @param limit - Maximum number of duplicate examples to return
   * @returns array of duplicate values
   */
  async getDuplicateValues(
    context: NcContext,
    column: Column,
    limit: number = 10,
  ): Promise<Array<{ value: any; count: number }>> {
    const model = await column.getModel(context);
    const source = await Source.get(context, model.source_id);
    const knex: CustomKnex = await NcConnectionMgrv2.get(source);

    // Get schema-qualified table name
    let tableName = model.table_name;
    if (source.type === 'pg') {
      // For PostgreSQL, include schema if available
      let schema: string;
      if (source?.isMeta?.(true, 1)) {
        schema = source.getConfig()?.schema;
      } else {
        schema = source.getConfig()?.searchPath?.[0];
      }
      if (schema) {
        tableName = `${schema}.${tableName}`;
      }
    } else if (source.type === 'snowflake') {
      // For Snowflake, include database and schema
      const config = source.getConfig()?.connection || source.getConfig();
      if (config?.database && config?.schema) {
        tableName = `${config.database}.${config.schema}.${tableName}`;
      }
    }

    const columnName = column.column_name;

    const query = knex(tableName)
      .select(columnName)
      .count('* as count')
      .whereNotNull(columnName)
      .groupBy(columnName)
      .having('count', '>', 1)
      .orderBy('count', 'desc')
      .limit(limit);

    const results = await query;

    return results.map((row) => ({
      value: row[columnName],
      count: parseInt(row.count),
    }));
  }
}
