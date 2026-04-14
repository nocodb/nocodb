import type { ErrorObject } from 'ajv';

/**
 * Converts a JSON Pointer instancePath to a human-readable field name.
 *
 * Examples:
 *   "" → "" (root)
 *   "/title" → "title"
 *   "/meta/color" → "meta.color"
 *   "/columns/0/uidt" → "columns[0].uidt"
 */
function instancePathToFieldName(instancePath: string): string {
  if (!instancePath) return '';

  return instancePath
    .slice(1) // remove leading "/"
    .split('/')
    .map((segment, i, _arr) => {
      // If this segment is a numeric index, wrap in brackets and attach to previous
      if (/^\d+$/.test(segment)) {
        return `[${segment}]`;
      }
      return i === 0 ? segment : `.${segment}`;
    })
    .join('');
}

/**
 * Returns the leaf field name from instancePath, or missingProperty for required errors.
 */
function getFieldName(error: ErrorObject): string {
  if (error.keyword === 'required') {
    return error.params.missingProperty;
  }
  if (error.keyword === 'additionalProperties') {
    return error.params.additionalProperty;
  }

  const path = instancePathToFieldName(error.instancePath);
  if (!path) return 'value';

  // Return the last segment as the field name
  const parts = path.replace(/\[\d+\]/g, '').split('.');
  return parts[parts.length - 1] || 'value';
}

/**
 * Maps well-known format names to human-readable descriptions.
 */
const FORMAT_LABELS: Record<string, string> = {
  email: 'email address',
  uri: 'URI',
  url: 'URL',
  'uri-reference': 'URI reference',
  'date-time': 'date-time (ISO 8601)',
  date: 'date (YYYY-MM-DD)',
  time: 'time (HH:mm:ss)',
  ipv4: 'IPv4 address',
  ipv6: 'IPv6 address',
  uuid: 'UUID',
  hostname: 'hostname',
  'json-pointer': 'JSON pointer',
  regex: 'regular expression',
};

/**
 * Checks if an error is a sub-branch error from oneOf/anyOf validation.
 * These are the per-branch failures that create noise — we collapse them
 * and keep only the top-level oneOf/anyOf error.
 */
function isOneOfAnyOfSubError(error: ErrorObject): boolean {
  return /\/(oneOf|anyOf)\/\d+\//.test(error.schemaPath);
}

/**
 * Formats a single AJV error into a human-readable message.
 */
function formatSingleError(error: ErrorObject): string {
  const field = getFieldName(error);
  const p = error.params;

  switch (error.keyword) {
    case 'required':
      return `'${p.missingProperty}' is required`;

    case 'type':
      return `'${field}' must be ${addArticle(p.type)}`;

    case 'enum':
      return `'${field}' must be one of: ${(p.allowedValues as string[]).join(
        ', ',
      )}`;

    case 'const':
      return `'${field}' must be '${p.allowedValue}'`;

    case 'minLength':
      if (p.limit === 1) {
        return `'${field}' must not be empty`;
      }
      return `'${field}' must be at least ${p.limit} characters`;

    case 'maxLength':
      return `'${field}' must be at most ${p.limit} characters`;

    case 'minimum':
      return `'${field}' must be ${p.limit} or greater`;

    case 'maximum':
      return `'${field}' must be ${p.limit} or less`;

    case 'exclusiveMinimum':
      return `'${field}' must be greater than ${p.limit}`;

    case 'exclusiveMaximum':
      return `'${field}' must be less than ${p.limit}`;

    case 'multipleOf':
      return `'${field}' must be a multiple of ${p.multipleOf}`;

    case 'pattern':
      return `'${field}' must match the required format`;

    case 'format':
      return `'${field}' must be a valid ${
        FORMAT_LABELS[p.format] || p.format
      }`;

    case 'minItems':
      return `'${field}' must contain at least ${p.limit} item${
        p.limit === 1 ? '' : 's'
      }`;

    case 'maxItems':
      return `'${field}' must contain at most ${p.limit} item${
        p.limit === 1 ? '' : 's'
      }`;

    case 'uniqueItems':
      return `'${field}' must not contain duplicate values`;

    case 'additionalProperties':
      return `Unexpected property '${p.additionalProperty}'`;

    case 'oneOf':
      return `'${field}' must match exactly one of the allowed schemas`;

    case 'anyOf':
      return `'${field}' must match at least one of the allowed types`;

    case 'if':
      return `'${field}' does not satisfy the conditional requirement`;

    default:
      // Fallback: use AJV's default message with a cleaner field prefix
      if (field && field !== 'value') {
        return `'${field}' ${error.message}`;
      }
      return error.message || 'Invalid value';
  }
}

/**
 * Adds "a" or "an" before a type name.
 */
function addArticle(type: string): string {
  if (/^(integer|object|array)$/i.test(type)) {
    return `an ${type}`;
  }
  return `a ${type}`;
}

/**
 * Transforms raw AJV ErrorObject[] into human-readable errors.
 *
 * - Collapses oneOf/anyOf sub-branch errors (keeps only the top-level error)
 * - Rewrites each error's `message` field to be user-friendly
 * - Preserves the original ErrorObject shape for backward compatibility
 */
export function formatAjvErrors(errors: ErrorObject[]): ErrorObject[] {
  if (!errors?.length) return [];

  // Collapse oneOf/anyOf: remove sub-branch errors
  const collapsed = errors.filter((e) => !isOneOfAnyOfSubError(e));

  // Deduplicate by formatted message (sub-branch errors from $ref-resolved
  // oneOf/anyOf branches produce identical messages that slip past the
  // schemaPath-based filter above)
  const seen = new Set<string>();
  return collapsed
    .map((error) => ({
      ...error,
      message: formatSingleError(error),
    }))
    .filter((error) => {
      if (seen.has(error.message)) return false;
      seen.add(error.message);
      return true;
    });
}

/**
 * Produces a single summary string from formatted AJV errors.
 *
 * Example: "Validation failed: 'title' is required, 'type' must be one of: table, view, form"
 */
export function formatAjvErrorMessage(errors: ErrorObject[]): string {
  const formatted = formatAjvErrors(errors);
  if (!formatted.length) return 'Invalid request body';

  const messages = formatted.map((e) => e.message);
  return `Validation failed: ${messages.join(', ')}`;
}
