import crypto from 'crypto';

export function randomTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function utf8ify(str: string): string {
  return Buffer.from(str, 'latin1').toString('utf8');
}

export function swaggerSanitizeSchemaName(name: string) {
  return name.replace(/\W/g, '_');
}

/**
 * Strip a matching pair of surrounding quote characters — straight, curly, or
 * backtick — looping to handle doubled quotes (`""title""`). Only matched pairs
 * are removed, so a legitimate one-sided quote in the text is left untouched.
 *
 * Useful for cleaning up LLM output, which frequently wraps a value in quotes
 * (e.g. `"My title"`) despite the prompt instructing otherwise.
 */
export function stripWrappingQuotes(value: string): string {
  let result = value.trim();

  // Opening → closing quote characters the model may emit.
  const quotePairs: ReadonlyArray<readonly [string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
    ['“', '”'], // “ ”
    ['‘', '’'], // ‘ ’
  ];

  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const [open, close] of quotePairs) {
      if (
        result.length >= open.length + close.length &&
        result.startsWith(open) &&
        result.endsWith(close)
      ) {
        result = result.slice(open.length, result.length - close.length).trim();
        stripped = true;
        break;
      }
    }
  }

  return result;
}

/**
 * Recursively walks any JS value and replaces exact-string matches
 * using a provided Map<string, string>.
 *
 * @param value Any nested structure: object, array, primitive
 * @param replacements A Map of old -> new IDs
 * @returns A deep-cloned structure with replacements applied
 */
export function deepReplaceStrings<T>(
  value: T,
  replacements: Map<string, string>,
): T {
  if (value === null || value === undefined) return value;

  // Primitive values
  if (typeof value !== 'object') {
    if (typeof value === 'string' && replacements.has(value)) {
      return replacements.get(value) as T;
    }
    return value;
  }

  // Arrays
  if (Array.isArray(value)) {
    return value.map((item) =>
      deepReplaceStrings(item, replacements),
    ) as unknown as T;
  }

  // Objects
  const result: any = {};
  for (const key of Object.keys(value as object)) {
    const val: any = (value as any)[key];

    if (typeof val === 'string' && replacements.has(val)) {
      result[key] = replacements.get(val);
    } else {
      result[key] = deepReplaceStrings(val, replacements);
    }
  }

  return result as T;
}

// get base 64 file string size, without buffer
export function getBase64FileSize(base64String: string) {
  const len = base64String.length;

  // Count padding at the end
  let padding = 0;
  if (len > 0 && base64String[len - 1] === '=') {
    padding++;
    if (len > 1 && base64String[len - 2] === '=') {
      padding++;
    }
  }

  // Calculate actual file size in bytes
  return (len * 3) / 4 - padding;
}
