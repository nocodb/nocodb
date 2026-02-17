import { UITypes } from './';

/**
 * Field types that support unique constraints
 */
export const UNIQUE_CONSTRAINT_SUPPORTED_TYPES = [
  UITypes.SingleLineText,
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

/**
 * Validates if a field type supports unique constraints
 * @param uidt - UI data type
 * @param meta - Column metadata (for rich text check)
 * @returns true if the field type supports unique constraints
 */
export function isUniqueConstraintSupportedType(
  uidt: UITypes,
  meta?: any
): boolean {
  // Check for LongText with rich text enabled (not supported)
  if (uidt === UITypes.LongText && meta?.richMode) {
    return false;
  }

  return UNIQUE_CONSTRAINT_SUPPORTED_TYPES.includes(uidt);
}
