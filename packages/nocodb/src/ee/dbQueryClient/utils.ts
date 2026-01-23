import type { Column } from '~/models';

/**
 * Normalizes an ID value for use in database queries.
 * Handles multiple ID formats: string, object with PK properties, and composite keys.
 *
 * @param id - The ID value to normalize (string for simple/composite keys, object with PK properties)
 * @param primaryKeys - Array of primary key columns from the model
 * @returns Array of normalized ID values ready for SQL parameter binding
 */
export function normalizeIdForQuery(
  id: string | Record<string, any>,
  primaryKeys: Column[],
): any[] {
  // If id is an object, extract values from the object using PK column names
  if (typeof id === 'object') {
    return primaryKeys.map((c) => {
      const idVal = id?.[c.title] ?? id?.[c.column_name];
      // For composite keys, escape underscores to avoid conflicts with separator
      return primaryKeys.length > 1 ? idVal?.toString?.() ?? null : idVal;
    });
  }

  // If single primary key, wrap in array
  if (primaryKeys.length === 1) {
    return [id];
  }

  // For composite keys passed as string: split by separator and unescape underscores
  return id.split('___').map((idPart) => idPart.replaceAll('\\_', '_'));
}
