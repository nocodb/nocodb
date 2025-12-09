import { UniqueConstraintViolationError } from 'nocodb-sdk';
import { ViewTypes } from 'nocodb-sdk';
import type { Column } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { XKnex } from '~/db/CustomKnex';
import View from '~/models/View';
import FormViewColumn from '~/models/FormViewColumn';

/**
 * Extracts column name from database error message
 * @param error - Database error
 * @param clientType - Database client type
 * @returns column name if found, null otherwise
 */
function extractColumnNameFromError(
  error: any,
  _clientType?: string,
): string | null {
  // Try multiple sources for error message
  const errorMessage =
    error?.message ||
    error?.sqlMessage ||
    error?.detail ||
    error?.original?.message ||
    error?.original?.detail ||
    '';

  // PostgreSQL: Multiple possible formats:
  // 1. "duplicate key value violates unique constraint ... Key (column_name)=(value) already exists."
  // 2. "duplicate key value violates unique constraint \"constraint_name\" Detail: Key (column_name)=(value) already exists."
  // 3. "duplicate key value violates unique constraint \"table_column_name_key\" Detail: Key (column_name)=(value) already exists."
  // 4. "Key ("Text_7")=(a) already exists." (with quoted column names)
  // Try to extract from Key (column_name) pattern first
  const pgMatch = errorMessage.match(/Key \(([^)]+)\)=/);
  if (pgMatch) {
    // Extract column name and strip surrounding quotes if present
    const columnName = pgMatch[1].split(',')[0].trim();
    // Remove surrounding double or single quotes
    return columnName.replace(/^["']|["']$/g, '');
  }

  // Try to extract from constraint name pattern: "table_column_name_key" or "table_column_name_unique"
  const pgConstraintMatch = errorMessage.match(
    /constraint ["']?([^"']+)["']?/i,
  );
  if (pgConstraintMatch) {
    const constraintName = pgConstraintMatch[1];
    // Extract column name from constraint name patterns like: table_column_name_key, table_column_name_unique
    const columnFromConstraint = constraintName.match(
      /_([^_]+)_(?:key|unique)$/i,
    );
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
    const mysqlTableColMatch = errorMessage.match(
      /for key ['"]?[^.]+\.([^'"]+)['"]?/i,
    );
    if (mysqlTableColMatch) {
      return mysqlTableColMatch[1];
    }
  }

  // SQLite: "UNIQUE constraint failed: table.column_name"
  // Also handles: "UNIQUE constraint failed: column_name" (without table prefix)
  const sqliteMatch = errorMessage.match(
    /UNIQUE constraint failed: (?:[^.]+\.)?([^\s,]+)/i,
  );
  if (sqliteMatch) {
    return sqliteMatch[1];
  }

  return null;
}

/**
 * Queries the database to find which unique column has a duplicate value
 * @param dbDriver - Database driver instance
 * @param tableName - Table name (can include schema)
 * @param uniqueColumns - Array of unique columns to check
 * @param insertData - Insert/update data to check values against
 * @returns The column that has a duplicate value, or null if not found
 */
async function findDuplicateColumnByQuery(
  dbDriver: XKnex,
  tableName: string | any,
  uniqueColumns: Column[],
  insertData: Record<string, any>,
): Promise<{ column: Column; value: any } | null> {
  // Check each unique column that has a value in the payload
  for (const column of uniqueColumns) {
    // Get the value from payload (check both column_name and title)
    const value = insertData[column.column_name] ?? insertData[column.title];

    // Skip if value is null, undefined, or empty
    if (value === null || value === undefined || value === '') {
      continue;
    }

    try {
      // Query the database to see if this value already exists
      const query = dbDriver(tableName)
        .where(column.column_name, value)
        .limit(1);
      const existing = await query.first();

      if (existing) {
        // Found a duplicate - this is the column causing the issue
        return { column, value };
      }
    } catch (e) {
      // If query fails, continue to next column
      // This can happen if column doesn't exist or other issues
      continue;
    }
  }

  return null;
}

/**
 * Parameters for handleUniqueConstraintError
 */
export interface HandleUniqueConstraintErrorParams {
  /** Database error */
  error: any;
  /** BaseModel instance to extract context, columns, dbDriver, tableName, viewId from */
  baseModel: IBaseModelSqlV2;
  /** Optional insert/update data to help identify which column caused the violation */
  insertData?: Record<string, any>;
}

/**
 * Converts database unique constraint violation error to UniqueConstraintViolationError
 * Throws UniqueConstraintViolationError if it's a unique constraint violation, otherwise does nothing
 */
export async function handleUniqueConstraintError({
  error,
  baseModel,
  insertData,
}: HandleUniqueConstraintErrorParams): Promise<void> {
  // Extract data from baseModel
  const context = baseModel.context;
  const modelColumns = await baseModel.model.getColumns(context);
  const clientType = baseModel.dbDriver.clientType();
  const dbDriver = baseModel.dbDriver;
  const tableName = baseModel.tnPath;
  const viewId = baseModel.viewId;
  // ULTRA-EARLY CHECK: If we see error code 23505 ANYWHERE, handle it immediately
  // This check happens before any other logic to ensure we never miss it
  // Check ALL possible locations and formats - be extremely thorough
  // Also check if error was processed by extractDBError (has error.error === 'ERR_DATABASE_OP_FAILED')

  // First, try to safely stringify the error to search for '23505' anywhere
  let errorString = '';
  try {
    errorString = JSON.stringify(error);
  } catch (e) {
    // If stringify fails (circular reference), try to stringify key properties
    errorString = JSON.stringify({
      code: error?.code,
      error: error?.error,
      message: error?.message,
      original: error?.original
        ? {
            code: error.original.code,
            message: error.original.message,
          }
        : null,
    });
  }

  const has23505Anywhere =
    error?.code === '23505' ||
    error?.code === 23505 ||
    error?.original?.code === '23505' ||
    error?.original?.code === 23505 ||
    error?.nativeError?.code === '23505' ||
    error?.nativeError?.code === 23505 ||
    String(error?.code) === '23505' ||
    String(error?.original?.code) === '23505' ||
    String(error?.nativeError?.code) === '23505' ||
    (error?.error === 'ERR_DATABASE_OP_FAILED' &&
      (error?.code === '23505' || error?.code === 23505)) ||
    // Also check errno (MySQL uses this)
    error?.errno === 23505 ||
    error?.original?.errno === 23505 ||
    error?.nativeError?.errno === 23505 ||
    // Deep check: recursively search for '23505' in the error object
    errorString.includes('23505');

  // CRITICAL: If we detect 23505, we MUST throw - no exceptions
  // This is the PRIMARY detection point - if this fails, nothing will work
  if (has23505Anywhere) {
    // This is definitely a unique constraint violation - handle it immediately
    const uniqueColumns = modelColumns.filter((c) => c.unique);

    // If no unique columns, still throw but with generic info
    if (uniqueColumns.length === 0) {
      throw new UniqueConstraintViolationError({
        value: 'unknown',
        fieldName: 'unknown',
      });
    }

    // Try to identify the column and value from error detail first
    let column = null;
    let value = 'unknown';

    // First, try to extract column name and value from error detail
    // PostgreSQL error detail format: "Key ("Text_7")=(a) already exists."
    const errorDetail =
      error?.detail ||
      error?.original?.detail ||
      error?.nativeError?.detail ||
      '';

    if (errorDetail) {
      // Extract column name from error detail
      const columnNameMatch = errorDetail.match(/Key\s*\(([^)]+)\)\s*=/);
      if (columnNameMatch) {
        const extractedColumnName = columnNameMatch[1]
          .split(',')[0]
          .trim()
          .replace(/^["']|["']$/g, ''); // Remove surrounding quotes

        // Find column by name
        column = modelColumns.find(
          (c) =>
            c.column_name === extractedColumnName ||
            c.column_name?.toLowerCase() === extractedColumnName.toLowerCase(),
        );

        // Extract value from error detail
        const valueMatch = errorDetail.match(
          /Key\s*\([^)]*\)\s*=\s*\(([^)]+)\)/,
        );
        if (valueMatch) {
          value = valueMatch[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    }

    // If we couldn't extract from error detail, try to find column from payload
    if (!column && insertData) {
      const columnsWithData = uniqueColumns.filter((c) => {
        const valueByName = insertData[c.column_name];
        const valueByTitle = insertData[c.title];
        return (
          (valueByName !== null &&
            valueByName !== undefined &&
            valueByName !== '') ||
          (valueByTitle !== null &&
            valueByTitle !== undefined &&
            valueByTitle !== '')
        );
      });

      if (columnsWithData.length > 0) {
        column = columnsWithData[0];
        value = String(
          insertData[column.column_name] ||
            insertData[column.title] ||
            'unknown',
        );
      }
    }

    // If we still can't identify the column and we have dbDriver and tableName,
    // query the database to find which column has the duplicate
    if (!column && dbDriver && tableName && insertData) {
      try {
        const duplicateInfo = await findDuplicateColumnByQuery(
          dbDriver,
          tableName,
          uniqueColumns,
          insertData,
        );
        if (duplicateInfo) {
          column = duplicateInfo.column;
          value = String(duplicateInfo.value || 'unknown');
        }
      } catch (e) {
        // If query fails, continue to fallback
      }
    }

    // Final fallback: use first unique column
    if (!column) {
      column = uniqueColumns[0];
      if (insertData && value === 'unknown') {
        value = String(
          insertData[column.column_name] ||
            insertData[column.title] ||
            'unknown',
        );
      }
    }

    // ALWAYS throw - this is critical
    // If we reach here and don't throw, the original error will be re-thrown
    // and processed by extractDBError, resulting in the generic message

    // Get field name: use form view custom label if available, otherwise use column title
    let fieldName = column?.title || column?.column_name || 'unknown';

    // If viewId is provided and it's a form view, check for custom label
    if (viewId && column) {
      try {
        const view = await View.get(context, viewId);
        if (view && view.type === ViewTypes.FORM) {
          // Get form view columns list and find the one matching this column
          // We need to use list() because View.getColumn expects formViewColumnId,
          // not column.id. For shared forms, we need to find by fk_column_id.
          const formViewColumns = await FormViewColumn.list(context, viewId);
          const formViewColumn = formViewColumns.find(
            (fvc) => fvc.fk_column_id === column.id,
          );
          if (
            formViewColumn &&
            'label' in formViewColumn &&
            formViewColumn.label
          ) {
            // Use custom label from form view
            fieldName = formViewColumn.label;
          }
        }
      } catch (e) {
        // If we can't get view or form column, fall back to column title
        // This is a non-critical error, so we continue with the default fieldName
      }
    }

    throw new UniqueConstraintViolationError({
      value: value,
      fieldName: fieldName,
    });
  }

  // If we didn't catch it above, continue with additional checks below

  // Check error code directly for unique constraint violations
  // Error might be nested in different properties depending on how it's caught
  // For Knex/PostgreSQL, error structure can be: error.code, error.original.code, or error.nativeError.code
  // Also check if error was already processed by DB error extractor (has error.error property)
  // Convert to string for comparison to handle both string and number codes
  // Also check the raw error object itself for code property

  const rawErrorCode = error?.code;
  const errorCode = String(
    rawErrorCode ||
      error?.errno ||
      error?.original?.code ||
      error?.original?.errno ||
      error?.nativeError?.code ||
      error?.nativeError?.errno ||
      '',
  );

  // CRITICAL CHECK: If the raw error code is 23505 (as string or number), this is definitely a unique constraint violation
  // This is the most reliable check and should always be handled
  // Check all possible locations for the error code - be very thorough
  const isDefinitelyUniqueError =
    rawErrorCode === '23505' ||
    rawErrorCode === 23505 ||
    errorCode === '23505' ||
    String(error?.code) === '23505' ||
    String(error?.original?.code) === '23505' ||
    String(error?.nativeError?.code) === '23505' ||
    error?.code === '23505' ||
    error?.code === 23505 ||
    error?.original?.code === '23505' ||
    error?.original?.code === 23505 ||
    error?.nativeError?.code === '23505' ||
    error?.nativeError?.code === 23505 ||
    // Also check if error was already processed by extractor
    (error?.error === 'ERR_DATABASE_OP_FAILED' &&
      (error?.code === '23505' || error?.code === 23505));

  const errorMessage = String(
    error?.message ||
      error?.original?.message ||
      error?.nativeError?.message ||
      error?.sqlMessage ||
      '',
  );

  // Check if error was processed by DB error extractor (has error.error === 'ERR_DATABASE_OP_FAILED' and code '23505')
  // Also check the message for "This record already exists" which is the generic message from the extractor
  // The message might have additional text after it, so we check if it starts with or contains the message
  const isExtractedDbError =
    (error?.error === 'ERR_DATABASE_OP_FAILED' &&
      (String(error?.code) === '23505' || errorCode === '23505')) ||
    (errorCode === '23505' &&
      (errorMessage === 'This record already exists.' ||
        errorMessage.trim().startsWith('This record already exists.') ||
        errorMessage.includes('This record already exists')));

  // Also check if the error message contains unique constraint indicators
  const hasUniqueConstraintMessage =
    /unique constraint|duplicate key|duplicate entry/i.test(errorMessage);

  const isUniqueViolation =
    errorCode === '23505' || // PostgreSQL
    errorCode === 'ER_DUP_ENTRY' || // MySQL
    (errorCode === 'SQLITE_CONSTRAINT' && /UNIQUE/i.test(errorMessage)) || // SQLite
    isExtractedDbError || // Error already processed by extractor
    (hasUniqueConstraintMessage &&
      (clientType === 'pg' || clientType === 'postgres')); // Fallback for PostgreSQL

  // Get unique columns first to check if we should handle this
  const uniqueColumns = modelColumns.filter((c) => c.unique);

  // CRITICAL: If error code is '23505' (PostgreSQL unique constraint), ALWAYS treat as unique violation
  // This is the most reliable indicator, regardless of error message or structure
  // Also check if error was processed by extractor (has error.error === 'ERR_DATABASE_OP_FAILED')
  const isPostgresUniqueError = errorCode === '23505';
  const isProcessedError =
    error?.error === 'ERR_DATABASE_OP_FAILED' && errorCode === '23505';
  const hasGenericMessage = errorMessage.includes('This record already exists');

  // If we detected a unique violation OR we have unique columns and the error code is 23505,
  // OR the error was processed by extractor with code 23505,
  // OR isDefinitelyUniqueError is true (most reliable check),
  // treat it as a unique constraint violation
  // This handles cases where the error structure is unusual but the code is correct
  const shouldHandleAsUniqueViolation =
    isDefinitelyUniqueError ||
    isUniqueViolation ||
    isPostgresUniqueError ||
    isProcessedError ||
    (hasGenericMessage && errorCode === '23505') ||
    (uniqueColumns.length > 0 && errorCode === '23505');

  // CRITICAL: If errorCode is '23505', we MUST handle it as a unique constraint violation
  // This is the most reliable indicator from PostgreSQL
  // Check ALL possible locations for the error code to ensure we catch it
  const has23505Code =
    errorCode === '23505' ||
    rawErrorCode === '23505' ||
    rawErrorCode === 23505 ||
    String(error?.code) === '23505' ||
    String(error?.original?.code) === '23505' ||
    String(error?.nativeError?.code) === '23505' ||
    error?.code === '23505' ||
    error?.original?.code === '23505' ||
    error?.nativeError?.code === '23505';

  // CRITICAL: If we detect error code 23505 anywhere, or if error was processed by extractor,
  // we MUST handle it as a unique constraint violation
  // Check for processed error structure (error.error === 'ERR_DATABASE_OP_FAILED' && code === '23505')
  const isProcessed23505 =
    error?.error === 'ERR_DATABASE_OP_FAILED' &&
    (error?.code === '23505' || error?.code === 23505);

  // ULTIMATE CHECK: If error code is 23505 in ANY form, we MUST throw UniqueConstraintViolationError IMMEDIATELY
  // This is the most critical check - if this fails, nothing will work
  // Check every possible location for the error code
  const definitelyHas23505 =
    has23505Code ||
    isProcessed23505 ||
    errorCode === '23505' ||
    String(error?.code) === '23505' ||
    error?.code === '23505' ||
    error?.code === 23505 ||
    String(error?.original?.code) === '23505' ||
    error?.original?.code === '23505' ||
    error?.original?.code === 23505 ||
    error?.nativeError?.code === '23505' ||
    error?.nativeError?.code === 23505;

  if (definitelyHas23505) {
    // We have confirmed this is a unique constraint violation - handle it immediately
    // Get unique columns to identify which one caused the issue
    const uniqueColumns = modelColumns.filter((c) => c.unique);

    if (uniqueColumns.length === 0) {
      // No unique columns in model, but error code confirms unique constraint violation
      throw new UniqueConstraintViolationError({
        value: 'unknown',
        fieldName: 'unknown',
      });
    }

    // Try to identify the column and value from error detail first
    let column = null;
    let value = 'unknown';

    // First, try to extract column name and value from error detail
    // PostgreSQL error detail format: "Key ("Text_7")=(a) already exists."
    const errorDetail =
      error?.detail ||
      error?.original?.detail ||
      error?.nativeError?.detail ||
      '';

    if (errorDetail) {
      // Extract column name from error detail
      const columnNameMatch = errorDetail.match(/Key\s*\(([^)]+)\)\s*=/);
      if (columnNameMatch) {
        const extractedColumnName = columnNameMatch[1]
          .split(',')[0]
          .trim()
          .replace(/^["']|["']$/g, ''); // Remove surrounding quotes

        // Find column by name
        column = modelColumns.find(
          (c) =>
            c.column_name === extractedColumnName ||
            c.column_name?.toLowerCase() === extractedColumnName.toLowerCase(),
        );

        // Extract value from error detail
        const valueMatch = errorDetail.match(
          /Key\s*\([^)]*\)\s*=\s*\(([^)]+)\)/,
        );
        if (valueMatch) {
          value = valueMatch[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    }

    // If we couldn't extract from error detail, try to find column from payload
    if (!column && insertData) {
      const columnsWithData = uniqueColumns.filter((c) => {
        const valueByName = insertData[c.column_name];
        const valueByTitle = insertData[c.title];
        return (
          (valueByName !== null &&
            valueByName !== undefined &&
            valueByName !== '') ||
          (valueByTitle !== null &&
            valueByTitle !== undefined &&
            valueByTitle !== '')
        );
      });

      if (columnsWithData.length > 0) {
        column = columnsWithData[0];
        // Only set value from insertData if we didn't extract it from error detail
        if (value === 'unknown') {
          value = String(
            insertData[column.column_name] ||
              insertData[column.title] ||
              'unknown',
          );
        }
      } else {
        column = uniqueColumns[0];
        // Only set value from insertData if we didn't extract it from error detail
        if (value === 'unknown') {
          value = String(
            insertData?.[column.column_name] ||
              insertData?.[column.title] ||
              'unknown',
          );
        }
      }
    } else {
      column = uniqueColumns[0];
    }

    // Get field name: use form view custom label if available, otherwise use column title
    // Ensure we use title, not column_name
    let fieldName = column?.title || column?.column_name || 'unknown';

    // If viewId is provided and it's a form view, check for custom label
    if (viewId && column) {
      try {
        const view = await View.get(context, viewId);
        if (view && view.type === ViewTypes.FORM) {
          // Get form view columns list and find the one matching this column
          // We need to use list() because View.getColumn expects formViewColumnId,
          // not column.id. For shared forms, we need to find by fk_column_id.
          const formViewColumns = await FormViewColumn.list(context, viewId);
          const formViewColumn = formViewColumns.find(
            (fvc) => fvc.fk_column_id === column.id,
          );
          if (
            formViewColumn &&
            'label' in formViewColumn &&
            formViewColumn.label
          ) {
            // Use custom label from form view
            fieldName = formViewColumn.label;
          }
        }
      } catch (e) {
        // If we can't get view or form column, fall back to column title
        // This is a non-critical error, so we continue with the default fieldName
      }
    }

    // Throw immediately - don't continue with complex logic
    throw new UniqueConstraintViolationError({
      value: value,
      fieldName: fieldName,
    });
  }

  if (!shouldHandleAsUniqueViolation) {
    return; // Not a unique constraint violation, let it propagate
  }

  // If it's a PostgreSQL unique error (23505), we MUST handle it, even if we can't identify the column
  // This ensures we always provide a meaningful error instead of the generic "This record already exists"

  // Create a normalized error object for extraction
  // If error was processed by extractor, try to get original error for detail extraction
  // PostgreSQL errors can have detail in: error.detail, error.original.detail, error.nativeError.detail
  const originalError = error?.original || error?.nativeError || error;
  const normalizedError = {
    code: errorCode,
    message: errorMessage,
    sqlMessage: error?.sqlMessage || originalError?.sqlMessage,
    detail:
      error?.detail ||
      error?.original?.detail ||
      error?.nativeError?.detail ||
      originalError?.detail,
  };

  // Extract column name from error (try normalized error first, then original error as fallback)
  let columnName = extractColumnNameFromError(normalizedError, clientType);
  if (!columnName) {
    columnName =
      extractColumnNameFromError(originalError, clientType) ||
      extractColumnNameFromError(error, clientType);
  }

  // If still no column name, try to infer from insert data
  // This is critical when the error message doesn't contain column information
  // (e.g., when error is processed by DB error extractor)
  if (!columnName && insertData) {
    const uniqueColumns = modelColumns.filter((c) => c.unique);
    const columnsWithData = uniqueColumns.filter((c) => {
      // Check both column_name and title in the payload
      const valueByName = insertData[c.column_name];
      const valueByTitle = insertData[c.title];
      const hasValue =
        (valueByName !== null &&
          valueByName !== undefined &&
          valueByName !== '') ||
        (valueByTitle !== null &&
          valueByTitle !== undefined &&
          valueByTitle !== '');
      return hasValue;
    });

    // If there's at least one unique column with data, use it
    // This is the primary fallback when error message doesn't have column info
    if (columnsWithData.length > 0) {
      columnName = columnsWithData[0].column_name;
      // If multiple unique columns have data, prefer the one that matches the constraint name pattern
      // from the error message if available
      if (columnsWithData.length > 1) {
        const constraintName = errorMessage.match(
          /constraint ["']?([^"']+)["']?/i,
        )?.[1];
        if (constraintName) {
          // Try to find a column whose name appears in the constraint name
          const matchingColumn = columnsWithData.find(
            (col) =>
              constraintName
                .toLowerCase()
                .includes(col.column_name.toLowerCase()) ||
              constraintName
                .toLowerCase()
                .includes(col.column_name.toLowerCase().replace(/_/g, '')),
          );
          if (matchingColumn) {
            columnName = matchingColumn.column_name;
          }
        }
      }
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

  // If still no column found, try to find by unique columns in the model
  // This is a fallback when we can't extract or match the column name
  if (!column) {
    const uniqueColumns = modelColumns.filter((c) => c.unique);
    if (uniqueColumns.length === 1) {
      // If only one unique column in the model, it's likely the one
      column = uniqueColumns[0];
      columnName = column.column_name;
    } else if (uniqueColumns.length > 0 && insertData) {
      // If multiple unique columns, prefer the one that has data in the payload
      const columnsWithData = uniqueColumns.filter((c) => {
        const value = insertData[c.column_name];
        return value !== null && value !== undefined && value !== '';
      });
      if (columnsWithData.length > 0) {
        column = columnsWithData[0];
        columnName = column.column_name;
      }
    }
  }

  // Extract value from error message if possible
  let value: string | undefined;

  // PostgreSQL: Extract from "Key (column)=(value)" or from detail field
  // PostgreSQL error detail often contains: "Key (column_name)=(value) already exists."
  // Also handles: "Key ("Text_7")=(a) already exists." (with quoted column names)
  const detailMessage =
    normalizedError.detail ||
    originalError?.detail ||
    error?.detail ||
    errorMessage;
  // Match pattern: Key (column_part)=(value_part) where value_part is captured
  // This handles both quoted and unquoted column names: Key ("Text_7")=(a) or Key (Text_7)=(a)
  const pgValueMatch = detailMessage.match(/Key\s*\([^)]*\)\s*=\s*\(([^)]+)\)/);
  if (pgValueMatch) {
    // Extract value and remove surrounding single or double quotes
    value = pgValueMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  // MySQL: Extract from "Duplicate entry 'value' for key"
  if (!value) {
    const mysqlValueMatch = errorMessage.match(
      /Duplicate entry ['"]([^'"]+)['"]/i,
    );
    if (mysqlValueMatch) {
      value = mysqlValueMatch[1];
    }
  }

  // SQLite: Extract from error message if available
  // SQLite doesn't always include the value, so we may not extract it

  // uniqueColumns was already computed above
  // If no unique columns exist, we can't provide a meaningful error message
  // But if errorCode is 23505, there's definitely a unique constraint violation
  // So we should still throw an error, just with less specific information
  if (uniqueColumns.length === 0) {
    // No unique columns in model, but error code suggests unique constraint violation
    // Throw a generic unique constraint error
    throw new UniqueConstraintViolationError({
      value: 'unknown',
      fieldName: 'unknown',
    });
  }

  // Use the found column or fall back to identifying from payload
  let finalColumn = column;
  let finalColumnName = columnName;

  // If we still don't have a column, try to identify from payload
  // Check both column_name and title (since payload might use either)
  if (!finalColumn && insertData) {
    const columnsWithData = uniqueColumns.filter((c) => {
      // Check both column_name and title in the payload
      const valueByName = insertData[c.column_name];
      const valueByTitle = insertData[c.title];
      const hasValue =
        (valueByName !== null &&
          valueByName !== undefined &&
          valueByName !== '') ||
        (valueByTitle !== null &&
          valueByTitle !== undefined &&
          valueByTitle !== '');
      return hasValue;
    });

    if (columnsWithData.length > 0) {
      finalColumn = columnsWithData[0];
      finalColumnName = finalColumn.column_name;
    }
  }

  // Final fallback: use the first unique column
  if (!finalColumn) {
    finalColumn = uniqueColumns[0];
    if (finalColumn) {
      finalColumnName = finalColumn.column_name;
    }
  }

  // Ensure we have a column object - if we only have finalColumnName, find the column from modelColumns
  if (!finalColumn && finalColumnName) {
    finalColumn = modelColumns.find(
      (c) =>
        c.column_name === finalColumnName ||
        c.column_name?.toLowerCase() === finalColumnName.toLowerCase(),
    );
  }

  // Extract value from insert data if not found in error message
  // Check both column_name and title in the payload
  if (!value && insertData && finalColumn) {
    const dataValue =
      insertData[finalColumn.column_name] || insertData[finalColumn.title];
    if (dataValue !== null && dataValue !== undefined && dataValue !== '') {
      value = String(dataValue);
    }
  }

  // If we still can't identify the column and we have dbDriver and tableName,
  // query the database to find which column has the duplicate
  if (
    !finalColumn &&
    dbDriver &&
    tableName &&
    insertData &&
    uniqueColumns.length > 0
  ) {
    try {
      const duplicateInfo = await findDuplicateColumnByQuery(
        dbDriver,
        tableName,
        uniqueColumns,
        insertData,
      );
      if (duplicateInfo) {
        finalColumn = duplicateInfo.column;
        finalColumnName = finalColumn.column_name;
        if (!value) {
          value = String(duplicateInfo.value || 'unknown');
        }
      }
    } catch (e) {
      // If query fails, use first unique column as fallback
      if (!finalColumn && uniqueColumns.length > 0) {
        finalColumn = uniqueColumns[0];
        finalColumnName = finalColumn.column_name;
      }
    }
  }

  // FINAL SAFETY CHECK: If errorCode is '23505' and we haven't thrown yet, we MUST throw
  // This is a last resort to ensure we never miss a unique constraint violation
  const finalErrorCode = String(
    error?.code || error?.original?.code || error?.nativeError?.code || '',
  );
  if (finalErrorCode === '23505' && !finalColumn && uniqueColumns.length > 0) {
    // We detected 23505 but couldn't identify column - use first unique column
    finalColumn = uniqueColumns[0];
    finalColumnName = finalColumn.column_name;
    if (insertData) {
      value = String(
        insertData[finalColumn.column_name] ||
          insertData[finalColumn.title] ||
          'unknown',
      );
    }
  }

  // Always throw UniqueConstraintViolationError for unique constraint violations
  // This ensures the error is properly handled by the global exception filter
  // CRITICAL: We must throw here - if we don't, the original error will be re-thrown
  // and processed by extractDBError in the global filter, resulting in a generic message

  // Get field name: use form view custom label if available, otherwise use column title
  // If finalColumn is null, try to find it from modelColumns using finalColumnName
  let columnForFieldName = finalColumn;
  if (!columnForFieldName && finalColumnName) {
    columnForFieldName = modelColumns.find(
      (c) =>
        c.column_name === finalColumnName ||
        c.column_name?.toLowerCase() === finalColumnName.toLowerCase(),
    );
  }

  // Always use title, never fall back to column_name
  // If title is empty or same as column_name, use title (it might be intentionally set that way)
  // Only use 'unknown' if we truly can't find the column
  let fieldName = 'unknown';
  if (columnForFieldName) {
    // Use title if available, otherwise it means title is empty/null which is unusual but possible
    fieldName =
      columnForFieldName.title || columnForFieldName.column_name || 'unknown';
  } else if (finalColumnName) {
    // Last resort: if we have column_name but no column object, try one more lookup
    const foundColumn = modelColumns.find(
      (c) =>
        c.column_name === finalColumnName ||
        c.column_name?.toLowerCase() === finalColumnName.toLowerCase(),
    );
    if (foundColumn) {
      fieldName = foundColumn.title || foundColumn.column_name || 'unknown';
      columnForFieldName = foundColumn; // Set it for form view label check below
    }
  }

  // If viewId is provided and it's a form view, check for custom label
  if (viewId && columnForFieldName) {
    try {
      const view = await View.get(context, viewId);
      if (view && view.type === ViewTypes.FORM) {
        // Get form view columns list and find the one matching this column
        // We need to use list() because View.getColumn expects formViewColumnId,
        // not column.id. For shared forms, we need to find by fk_column_id.
        const formViewColumns = await FormViewColumn.list(context, viewId);
        const formViewColumn = formViewColumns.find(
          (fvc) => fvc.fk_column_id === columnForFieldName.id,
        );
        if (
          formViewColumn &&
          'label' in formViewColumn &&
          formViewColumn.label
        ) {
          // Use custom label from form view
          fieldName = formViewColumn.label;
        }
      }
    } catch (e) {
      // If we can't get view or form column, fall back to column title
      // This is a non-critical error, so we continue with the default fieldName
    }
  }

  const errorToThrow = new UniqueConstraintViolationError({
    value: value || 'unknown',
    fieldName: fieldName,
  });

  // Ensure we always throw - this is critical for proper error handling
  throw errorToThrow;
}
