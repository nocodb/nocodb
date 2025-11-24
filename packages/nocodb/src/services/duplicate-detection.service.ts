import { Injectable } from '@nestjs/common';
import { UITypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type CustomKnex from '~/db/CustomKnex';
import { Column, Model, Source } from '~/models';
import { normalizeValueForUniqueCheck } from '~/helpers/uniqueConstraintHelpers';
import { NcError } from '~/helpers/catchError';
import { sanitize } from '~/helpers/sqlSanitize';
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
    excludeRowId?: string | number
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
        'Cannot exclude row: Primary key not found. Tables without primary keys cannot use row exclusion in duplicate checks.'
      );
    }

    let query = knex(tableName)
      .select(columnName)
      .whereNotNull(columnName)
      .where(columnName, '!=', '');

    // For text fields, we need to check for case-insensitive and trimmed duplicates
    if ([UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.PhoneNumber, UITypes.URL].includes(column.uidt)) {
      // Use database-specific case-insensitive comparison
      // Since we're already querying from the table, we can reference the column directly
      if (source.type === 'pg') {
        query = query.whereRaw(`LOWER(TRIM(??)) IS NOT NULL`, [columnName]);
      } else if (source.type === 'mysql2' || source.type === 'mysql') {
        query = query.whereRaw(`TRIM(??) IS NOT NULL`, [columnName]);
      } else {
        query = query.whereRaw(`LOWER(TRIM(??)) IS NOT NULL`, [columnName]);
      }
    }

    if (excludeRowId && primaryKey) {
      query = query.where(primaryKey.column_name, '!=', excludeRowId);
    }

    const results = await query;
    
    // Group by normalized values to detect duplicates
    const valueGroups = new Map<string, number>();
    
    for (const row of results) {
      const value = row[columnName];
      const normalizedValue = normalizeValueForUniqueCheck(value, column.uidt);
      
      if (normalizedValue !== null) {
        const key = String(normalizedValue);
        valueGroups.set(key, (valueGroups.get(key) || 0) + 1);
      }
    }
    
    // Count duplicates
    let duplicateCount = 0;
    for (const [, count] of valueGroups) {
      if (count > 1) {
        duplicateCount += count;
      }
    }
    
    return {
      hasDuplicates: duplicateCount > 0,
      count: duplicateCount
    };
  }

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
    excludeRowId?: string | number
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
        'Cannot exclude row: Primary key not found. Tables without primary keys cannot use row exclusion in unique value validation.'
      );
    }

    const normalizedValue = normalizeValueForUniqueCheck(value, column.uidt);
    
    if (normalizedValue === null) {
      return true; // Empty values are always allowed
    }

    let query = knex(tableName).count('* as count');

    // Build query based on field type
    if ([UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.PhoneNumber, UITypes.URL].includes(column.uidt)) {
      // Case-insensitive, trimmed comparison for text fields
      // Since we're already querying from the table, we can reference the column directly
      if (source.type === 'pg') {
        query = query.whereRaw(`LOWER(TRIM(??)) = LOWER(TRIM(?))`, [columnName, String(value)]);
      } else if (source.type === 'mysql2' || source.type === 'mysql') {
        query = query.whereRaw(`LOWER(TRIM(??)) = LOWER(TRIM(?))`, [columnName, String(value)]);
      } else {
        query = query.whereRaw(`LOWER(TRIM(??)) = LOWER(TRIM(?))`, [columnName, String(value)]);
      }
    } else {
      // Exact comparison for other types
      query = query.where(columnName, value);
    }

    if (excludeRowId && primaryKey) {
      query = query.where(primaryKey.column_name, '!=', excludeRowId);
    }

    const result = await query.first();
    const count = parseInt(result?.count || '0');
    
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
    limit: number = 10
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

    let query = knex(tableName)
      .select(columnName)
      .count('* as count')
      .whereNotNull(columnName)
      .where(columnName, '!=', '')
      .groupBy(columnName)
      .having('count', '>', 1)
      .orderBy('count', 'desc')
      .limit(limit);

    const results = await query;
    
    return results.map(row => ({
      value: row[columnName],
      count: parseInt(row.count)
    }));
  }
}