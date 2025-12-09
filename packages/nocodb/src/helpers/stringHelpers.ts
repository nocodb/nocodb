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
