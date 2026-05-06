export const ENTITY_NAME_MIN_LENGTH = 1;
export const ENTITY_NAME_MAX_LENGTH = 150;

/**
 * Allowed characters: Unicode letters, numbers, regular spaces, hyphens,
 * underscores, periods, parentheses, ampersands, commas, apostrophes.
 */
export const ENTITY_NAME_ALLOWED_PATTERN = /^[\p{L}\p{N} \-_.,&'()]+$/u;

/**
 * Must contain at least one Unicode letter or number.
 */
export const ENTITY_NAME_ALPHANUMERIC_PATTERN = /[\p{L}\p{N}]/u;

const CONSECUTIVE_SPACES_PATTERN = / {2,}/;

export function validateEntityName(
  name: string | undefined | null,
  entityLabel = 'Name'
): { valid: boolean; error?: string } {
  if (name == null || name.trim().length === 0) {
    return { valid: false, error: `${entityLabel} is required` };
  }

  const trimmed = name.trim();

  if (trimmed.length > ENTITY_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `${entityLabel} must be at most ${ENTITY_NAME_MAX_LENGTH} characters long`,
    };
  }

  if (!ENTITY_NAME_ALLOWED_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: `${entityLabel} can only contain letters, numbers, spaces, hyphens, underscores, periods, parentheses, ampersands, commas, and apostrophes`,
    };
  }

  if (!ENTITY_NAME_ALPHANUMERIC_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: `${entityLabel} must contain at least one letter or number`,
    };
  }

  if (CONSECUTIVE_SPACES_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: `${entityLabel} must not contain consecutive spaces`,
    };
  }

  return { valid: true };
}

const DISALLOWED_CHARS_PATTERN = /[^\p{L}\p{N} \-_.,&'()]/gu;

/**
 * Coerces an arbitrary string into a value that passes ENTITY_NAME_ALLOWED_PATTERN
 * by replacing disallowed characters with spaces, collapsing runs of whitespace,
 * and trimming. Returns an empty string if no allowed characters remain.
 */
export function sanitizeEntityName(name: string | undefined | null): string {
  if (name == null) return '';
  return name
    .replace(DISALLOWED_CHARS_PATTERN, ' ')
    .replace(CONSECUTIVE_SPACES_PATTERN, ' ')
    .trim();
}
