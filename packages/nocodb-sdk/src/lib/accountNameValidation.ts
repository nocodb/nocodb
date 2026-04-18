// packages/nocodb-sdk/src/lib/accountNameValidation.ts

export const ACCOUNT_NAME_MIN_LENGTH = 1;
export const ACCOUNT_NAME_MAX_LENGTH = 50;

/**
 * Allowed characters: Unicode letters, numbers, spaces, hyphens, underscores,
 * periods, parentheses, ampersands, commas, apostrophes.
 */
export const ACCOUNT_NAME_ALLOWED_PATTERN =
  /^[\p{L}\p{N}\s\-_.,&'()]+$/u;

/**
 * Must contain at least one Unicode letter or number.
 */
export const ACCOUNT_NAME_ALPHANUMERIC_PATTERN = /[\p{L}\p{N}]/u;

/**
 * Consecutive spaces pattern.
 */
const CONSECUTIVE_SPACES_PATTERN = /\s{2,}/;

export function validateAccountName(
  name: string | undefined | null,
): { valid: true } | { valid: false; error: string } {
  if (name == null || name.trim().length === 0) {
    return { valid: false, error: 'Account name is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length < ACCOUNT_NAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Account name must be at least ${ACCOUNT_NAME_MIN_LENGTH} character long`,
    };
  }

  if (trimmed.length > ACCOUNT_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Account name must be at most ${ACCOUNT_NAME_MAX_LENGTH} characters long`,
    };
  }

  if (!ACCOUNT_NAME_ALLOWED_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error:
        'Account name can only contain letters, numbers, spaces, hyphens, underscores, periods, parentheses, ampersands, commas, and apostrophes',
    };
  }

  if (!ACCOUNT_NAME_ALPHANUMERIC_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Account name must contain at least one letter or number',
    };
  }

  if (CONSECUTIVE_SPACES_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Account name must not contain consecutive spaces',
    };
  }

  return { valid: true };
}
