import { UITypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';

// Field types that support unique constraints
export const UNIQUE_CONSTRAINT_SUPPORTED_TYPES = [
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Email,
  UITypes.PhoneNumber,
  UITypes.URL,
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Date,
  UITypes.DateTime,
  UITypes.Time,
];

// Field types that are explicitly not supported
export const UNIQUE_CONSTRAINT_UNSUPPORTED_TYPES = [
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.Count,
  UITypes.MultiSelect,
  UITypes.Attachment,
  UITypes.Checkbox,
  UITypes.Button,
  UITypes.JSON,
  UITypes.Geometry,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.Collaborator,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.Formula,
  UITypes.Rating,
  UITypes.SingleSelect,
  UITypes.LinkToAnotherRecord,
  UITypes.Links,
];

/**
 * Validates if a field type supports unique constraints
 * @param uidt - UI data type
 * @param meta - Column metadata (for rich text check)
 * @returns true if the field type supports unique constraints
 */
export function isUniqueConstraintSupportedType(uidt: UITypes, meta?: any): boolean {
  // Check for LongText with rich text enabled (not supported)
  if (uidt === UITypes.LongText && meta?.richMode) {
    return false;
  }
  
  return UNIQUE_CONSTRAINT_SUPPORTED_TYPES.includes(uidt);
}

/**
 * Validates unique constraint request and throws error if invalid
 * @param context - NocoDB context
 * @param uidt - UI data type
 * @param meta - Column metadata
 * @param unique - Unique constraint value
 */
export function validateUniqueConstraint(
  context: NcContext,
  uidt: UITypes,
  meta?: any,
  unique?: boolean,
): void {
  if (!unique) return; // No validation needed if not setting unique

  if (!isUniqueConstraintSupportedType(uidt, meta)) {
    const fieldTypeName = UITypes[uidt] || uidt;
    NcError.get(context).badRequest(
      `Unique constraint is not supported for field type '${fieldTypeName}'`
    );
  }
}

/**
 * Normalizes value for unique constraint comparison
 * Handles case-insensitive comparison and whitespace trimming
 * @param value - Value to normalize
 * @param uidt - UI data type
 * @returns normalized value
 */
export function normalizeValueForUniqueCheck(value: any, uidt: UITypes): any {
  if (value === null || value === undefined || value === '') {
    return null; // Treat empty values as null
  }

  // For text-based fields, trim whitespace and convert to lowercase
  if ([UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.PhoneNumber, UITypes.URL].includes(uidt)) {
    return String(value).trim().toLowerCase();
  }

  return value;
}

/**
 * Generates unique index name for a column
 * @param tableName - Table name
 * @param columnName - Column name
 * @returns unique index name
 */
export function generateUniqueIndexName(tableName: string, columnName: string): string {
  const sanitizedTable = tableName.replace(/\W+/g, '_').slice(0, 20);
  const sanitizedColumn = columnName.replace(/\W+/g, '_').slice(0, 20);
  const timestamp = Date.now().toString().slice(-8);
  
  return `uk_${sanitizedTable}_${sanitizedColumn}_${timestamp}`;
}