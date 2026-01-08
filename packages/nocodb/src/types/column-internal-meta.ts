/**
 * Internal metadata for columns
 * This is not exposed via API and is used internally for constraint management
 */
export interface ColumnInternalMeta {
  /**
   * Unique constraint name stored in the database
   * Used to drop constraints even if table/column name changes
   */
  unique_constraint_name?: string;
}

/**
 * Validates that the internal_meta object conforms to the expected structure
 * @param value - Value to validate
 * @returns true if valid, throws error if invalid
 */
export function validateColumnInternalMeta(
  value: any,
): value is ColumnInternalMeta {
  if (value === null || value === undefined) {
    return true; // null/undefined is valid (no internal meta)
  }

  if (typeof value !== 'object') {
    throw new Error('internal_meta must be an object');
  }

  // Check for unknown properties
  const allowedKeys = ['unique_constraint_name'];
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      throw new Error(
        `Unknown property '${key}' in internal_meta. Allowed properties: ${allowedKeys.join(
          ', ',
        )}`,
      );
    }
  }

  // Validate unique_constraint_name if present
  if (value.unique_constraint_name !== undefined) {
    if (typeof value.unique_constraint_name !== 'string') {
      throw new Error('unique_constraint_name must be a string');
    }
    if (value.unique_constraint_name.trim() === '') {
      throw new Error('unique_constraint_name cannot be empty');
    }
  }

  return true;
}
