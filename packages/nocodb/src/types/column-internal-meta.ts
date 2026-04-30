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

  /**
   * PostgreSQL enum type name (udt_name) backing this SingleSelect column.
   * Set during external schema introspection when pg_type.typtype = 'e'.
   * Cleared when the column is converted away from native enum (to text/etc.).
   */
  pg_enum_type_name?: string;

  /**
   * Schema (namespace) the PG enum type lives in. Captured at introspection
   * because an enum can live in a different schema from the table that uses
   * it — we cannot assume the source's configured schema.
   */
  pg_enum_schema_name?: string;
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
  const allowedKeys = [
    'unique_constraint_name',
    'pg_enum_type_name',
    'pg_enum_schema_name',
  ];
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

  // Validate pg_enum_type_name if present
  if (value.pg_enum_type_name !== undefined) {
    if (typeof value.pg_enum_type_name !== 'string') {
      throw new Error('pg_enum_type_name must be a string');
    }
    if (value.pg_enum_type_name.trim() === '') {
      throw new Error('pg_enum_type_name cannot be empty');
    }
  }

  // Validate pg_enum_schema_name if present
  if (value.pg_enum_schema_name !== undefined) {
    if (typeof value.pg_enum_schema_name !== 'string') {
      throw new Error('pg_enum_schema_name must be a string');
    }
    if (value.pg_enum_schema_name.trim() === '') {
      throw new Error('pg_enum_schema_name cannot be empty');
    }
  }

  // pg_enum_type_name and pg_enum_schema_name must be set together — an
  // unqualified type name is not addressable, and a schema with no type name
  // is meaningless. Reject partial state so it cannot be persisted via
  // direct Column.update calls.
  const hasEnumTypeName = value.pg_enum_type_name !== undefined;
  const hasEnumSchemaName = value.pg_enum_schema_name !== undefined;
  if (hasEnumTypeName !== hasEnumSchemaName) {
    throw new Error(
      'pg_enum_type_name and pg_enum_schema_name must be set together',
    );
  }

  return true;
}
