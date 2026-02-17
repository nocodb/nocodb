import {
  isUniqueConstraintSupportedType,
  UITypes,
  UNIQUE_CONSTRAINT_SUPPORTED_TYPES,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { Source } from '~/models';
import { NcError } from '~/helpers/catchError';

// Re-export from SDK
export { isUniqueConstraintSupportedType, UNIQUE_CONSTRAINT_SUPPORTED_TYPES };

/**
 * Validates unique constraint request and throws error if invalid
 * @param context - NocoDB context
 * @param uidt - UI data type
 * @param meta - Column metadata
 * @param unique - Unique constraint value
 * @param source - Source object to check if it's NC-DB
 * @param cdf - Column default value (to check mutual exclusivity)
 */
export function validateUniqueConstraint(
  context: NcContext,
  uidt: UITypes,
  meta?: any,
  unique?: boolean,
  source?: Pick<Source, 'is_local' | 'is_meta'>,
  cdf?: string,
): void {
  if (!unique) return; // No validation needed if not setting unique

  // Check if source is NC-DB (meta or local)
  if (source && !source.is_meta && !source.is_local) {
    NcError.get(context).badRequest(
      'Unique constraint is only supported for NC-DB (not external databases)',
    );
  }

  // Check if field type supports unique constraint
  if (!isUniqueConstraintSupportedType(uidt, meta)) {
    const fieldTypeName = UITypes[uidt] || uidt;
    NcError.get(context).badRequest(
      `Unique constraint is not supported for field type '${fieldTypeName}'`,
    );
  }

  // Check if default value is set (mutually exclusive with unique constraint)
  if (cdf !== null && cdf !== undefined && cdf !== '') {
    NcError.get(context).badRequest(
      'Cannot enable unique constraint because a default value is set. Please remove the default value first.',
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
  if (
    [
      UITypes.SingleLineText,
      UITypes.Email,
      UITypes.PhoneNumber,
      UITypes.URL,
    ].includes(uidt)
  ) {
    return String(value).trim().toLowerCase();
  }

  return value;
}
