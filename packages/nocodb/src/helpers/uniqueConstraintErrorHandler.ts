import { UniqueConstraintViolationError } from 'nocodb-sdk';
import type { Column } from '~/models';
import type { NcContext } from '~/interface/config';

/**
 * Extracts column name from database error message
 * @param error - Database error
 * @param clientType - Database client type
 * @returns column name if found, null otherwise
 */
function extractColumnNameFromError(
  error: any,
  clientType?: string,
): string | null {
  // Try multiple sources for error message
  const errorMessage = error?.message || error?.sqlMessage || error?.detail || error?.original?.message || error?.original?.detail || '';

  // PostgreSQL: Multiple possible formats:
  // 1. "duplicate key value violates unique constraint ... Key (column_name)=(value) already exists."
  // 2. "duplicate key value violates unique constraint \"constraint_name\" Detail: Key (column_name)=(value) already exists."
  // 3. "duplicate key value violates unique constraint \"table_column_name_key\" Detail: Key (column_name)=(value) already exists."
  // Try to extract from Key (column_name) pattern first
  const pgMatch = errorMessage.match(/Key \(([^)]+)\)=/);
  if (pgMatch) {
    return pgMatch[1].split(',')[0].trim(); // Get first column if composite
  }
  
  // Try to extract from constraint name pattern: "table_column_name_key" or "table_column_name_unique"
  const pgConstraintMatch = errorMessage.match(/constraint ["']?([^"']+)["']?/i);
  if (pgConstraintMatch) {
    const constraintName = pgConstraintMatch[1];
    // Extract column name from constraint name patterns like: table_column_name_key, table_column_name_unique
    const columnFromConstraint = constraintName.match(/_([^_]+)_(?:key|unique)$/i);
    if (columnFromConstraint) {
      return columnFromConstraint[1];
    }
  }

  // MySQL: Multiple possible formats:
  // 1. "Duplicate entry 'value' for key 'column_name'"
  // 2. "Duplicate entry 'value' for key 'PRIMARY'"
  // 3. "Duplicate entry 'value' for key 'table.column_name'"
  // 4. "Duplicate entry 'value' for key 'unique_index_name'"
  // Try to extract from constraint name or key name
  if (error?.code === 'ER_DUP_ENTRY') {
    // Try to match: "for key 'column_name'" or "for key \"column_name\""
    const mysqlKeyMatch = errorMessage.match(/for key ['"]?([^'"]+)['"]?/i);
    if (mysqlKeyMatch) {
      const keyName = mysqlKeyMatch[1];
      // If it's not 'PRIMARY', try to extract column name
      // Sometimes MySQL uses index names, so we return the key name
      // and let the caller match it against column names
      return keyName;
    }
    
    // Alternative: Try to match column name from table.column format
    const mysqlTableColMatch = errorMessage.match(/for key ['"]?[^.]+\.([^'"]+)['"]?/i);
    if (mysqlTableColMatch) {
      return mysqlTableColMatch[1];
    }
  }

  // SQLite: "UNIQUE constraint failed: table.column_name"
  // Also handles: "UNIQUE constraint failed: column_name" (without table prefix)
  const sqliteMatch = errorMessage.match(/UNIQUE constraint failed: (?:[^.]+\.)?([^\s,]+)/i);
  if (sqliteMatch) {
    return sqliteMatch[1];
  }

  return null;
}

/**
 * Converts database unique constraint violation error to UniqueConstraintViolationError
 * Throws UniqueConstraintViolationError if it's a unique constraint violation, otherwise does nothing
 * @param error - Database error
 * @param context - NocoDB context
 * @param modelColumns - Model columns to find column by name
 * @param clientType - Database client type
 * @param insertData - Optional insert/update data to help identify which column caused the violation
 */
export function handleUniqueConstraintError(
  error: any,
  context: NcContext,
  modelColumns: Column[],
  clientType?: string,
  insertData?: Record<string, any>,
): void {
  // Check error code directly for unique constraint violations
  // Error might be nested in different properties depending on how it's caught
  // For Knex/PostgreSQL, error structure can be: error.code, error.original.code, or error.nativeError.code
  // Also check if error was already processed by DB error extractor (has error.error property)
  const errorCode = error?.code || 
                    error?.errno || 
                    error?.original?.code || 
                    error?.original?.errno ||
                    error?.nativeError?.code ||
                    error?.nativeError?.errno;
  
  const errorMessage = error?.message || 
                       error?.original?.message || 
                       error?.nativeError?.message || 
                       error?.sqlMessage || 
                       '';
  
  // Check if error was processed by DB error extractor (has error.error === 'ERR_DATABASE_OP_FAILED' and code '23505')
  const isExtractedDbError = error?.error === 'ERR_DATABASE_OP_FAILED' && 
                             (error?.code === '23505' || errorCode === '23505');
  
  // Also check if the error message contains unique constraint indicators
  const hasUniqueConstraintMessage = /unique constraint|duplicate key|duplicate entry/i.test(errorMessage);
  
  const isUniqueViolation =
    errorCode === '23505' || // PostgreSQL
    errorCode === 'ER_DUP_ENTRY' || // MySQL
    (errorCode === 'SQLITE_CONSTRAINT' && /UNIQUE/i.test(errorMessage)) || // SQLite
    isExtractedDbError || // Error already processed by extractor
    (hasUniqueConstraintMessage && (clientType === 'pg' || clientType === 'postgres')); // Fallback for PostgreSQL

  if (!isUniqueViolation) {
    return; // Not a unique constraint violation, let it propagate
  }
  
  // Create a normalized error object for extraction
  // If error was processed by extractor, try to get original error for detail extraction
  const originalError = error?.original || error?.nativeError || error;
  const normalizedError = {
    code: errorCode,
    message: errorMessage,
    sqlMessage: error?.sqlMessage || originalError?.sqlMessage,
    detail: error?.detail || originalError?.detail,
  };

  // Extract column name from error (try normalized error first, then original error as fallback)
  let columnName = extractColumnNameFromError(normalizedError, clientType);
  if (!columnName) {
    columnName = extractColumnNameFromError(originalError, clientType) || 
                 extractColumnNameFromError(error, clientType);
  }
  
  // If still no column name, try to infer from insert data
  // Check which unique columns have values in the insert data
  if (!columnName && insertData) {
    const uniqueColumns = modelColumns.filter((c) => c.unique);
    const columnsWithData = uniqueColumns.filter((c) => {
      const value = insertData[c.column_name];
      return value !== null && value !== undefined && value !== '';
    });
    
    // If only one unique column has data, it's likely the one
    if (columnsWithData.length === 1) {
      columnName = columnsWithData[0].column_name;
    }
  }

  // Find column by column_name
  // Also try matching against index names or constraint names for MySQL
  let column = columnName
    ? modelColumns.find((c) => c.column_name === columnName)
    : null;

  // If not found by exact match, try case-insensitive match
  if (!column && columnName) {
    column = modelColumns.find(
      (c) => c.column_name?.toLowerCase() === columnName.toLowerCase(),
    );
  }

  // For MySQL, if column name is an index name, try to find by unique index
  // This is a fallback - ideally the error message should contain the actual column name
  if (!column && columnName && clientType === 'mysql2') {
    // Try to find columns with unique constraints that might match
    const uniqueColumns = modelColumns.filter((c) => c.unique);
    if (uniqueColumns.length === 1) {
      // If only one unique column, it's likely the one
      column = uniqueColumns[0];
    }
  }

  // Extract value from error message if possible
  let value: string | undefined;
  
  // PostgreSQL: Extract from "Key (column)=(value)" or from detail field
  // PostgreSQL error detail often contains: "Key (column_name)=(value) already exists."
  const detailMessage = normalizedError.detail || originalError?.detail || error?.detail || errorMessage;
  const pgValueMatch = detailMessage.match(/\([^)]*\)=\(([^)]+)\)/);
  if (pgValueMatch) {
    value = pgValueMatch[1].trim().replace(/^'|'$/g, ''); // Remove surrounding quotes
  }
  
  // MySQL: Extract from "Duplicate entry 'value' for key"
  if (!value) {
    const mysqlValueMatch = errorMessage.match(/Duplicate entry ['"]([^'"]+)['"]/i);
    if (mysqlValueMatch) {
      value = mysqlValueMatch[1];
    }
  }
  
  // SQLite: Extract from error message if available
  // SQLite doesn't always include the value, so we may not extract it

  // Throw UniqueConstraintViolationError
  throw new UniqueConstraintViolationError({
    value: value || 'unknown',
    fieldName: column?.title || columnName || 'unknown',
  });
}

