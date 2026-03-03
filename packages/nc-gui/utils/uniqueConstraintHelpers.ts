import { type ColumnType, UITypes, UNIQUE_CONSTRAINT_SUPPORTED_TYPES, isUniqueConstraintSupportedType } from 'nocodb-sdk'

// Re-export from SDK
export { isUniqueConstraintSupportedType, UNIQUE_CONSTRAINT_SUPPORTED_TYPES }

/**
 * Checks if unique constraint can be enabled for a column
 * @param column - Column to check
 * @param isXcdbBase - Whether the source is NC-DB
 * @returns object with canEnable flag and reason if cannot enable
 */
export function canEnableUniqueConstraint(column: ColumnType, isXcdbBase: boolean): { canEnable: boolean; reason?: string } {
  // Check if source is NC-DB
  if (!isXcdbBase) {
    return {
      canEnable: false,
      reason: 'Unique constraint is only supported for NC-DB (not external databases)',
    }
  }

  // Check if field type supports unique constraint
  if (!isUniqueConstraintSupportedType(column.uidt, column.meta)) {
    const fieldTypeName = UITypes[column.uidt] || column.uidt
    return {
      canEnable: false,
      reason: `Unique constraint is not supported for field type '${fieldTypeName}'`,
    }
  }

  // Check if default value is set (mutually exclusive)
  if (column.cdf !== null && column.cdf !== undefined && column.cdf !== '') {
    return {
      canEnable: false,
      reason: 'Cannot enable unique constraint because a default value is set. Please remove the default value first.',
    }
  }

  return { canEnable: true }
}
