import type { Column } from '~/models';
import { NcError } from '~/helpers/catchError';

/**
 * Normalizes an ID value for use in database queries.
 * Handles multiple ID formats: string, object with PK properties, and composite keys.
 *
 * @param id - The ID value to normalize (string for simple/composite keys, object with PK properties)
 * @param primaryKeys - Array of primary key columns from the model
 * @param skipPkValidation - Optional flag to skip primary key validation (default: false)
 * @returns Array of normalized ID values ready for SQL parameter binding
 */
export function normalizeIdForQuery(
  id: string | Record<string, any>,
  primaryKeys: Column[],
  skipPkValidation = false,
): any[] {
  // If id is an object, extract values from the object using PK column names
  if (typeof id === 'object') {
    return primaryKeys.map((c) => {
      const idVal = id?.[c.title] ?? id?.[c.column_name];

      // Validate value if auto-increment column
      // todo: add more validation based on column constraints
      if (!skipPkValidation && c.ai && !/^\d+$/.test(idVal)) {
        NcError.invalidPrimaryKey(idVal, c.title);
      }

      // For composite keys, escape underscores to avoid conflicts with separator
      return primaryKeys.length > 1 ? idVal?.toString?.() ?? null : idVal;
    });
  }

  // If single primary key, wrap in array
  if (primaryKeys.length === 1) {
    // Validate single primary key if it's auto-increment
    if (!skipPkValidation && primaryKeys[0].ai && !/^\d+$/.test(id)) {
      NcError.invalidPrimaryKey(id, primaryKeys[0].title);
    }
    return [id];
  }

  // For composite keys passed as string: split by separator and unescape underscores
  const idValues = id
    .split('___')
    .map((idPart) => idPart.replaceAll('\\_', '_'));

  // Validate composite primary key values if they're auto-increment
  if (!skipPkValidation) {
    primaryKeys.forEach((pk, idx) => {
      if (pk.ai && !/^\d+$/.test(idValues[idx])) {
        NcError.invalidPrimaryKey(idValues[idx], pk.title);
      }
    });
  }

  return idValues;
}
