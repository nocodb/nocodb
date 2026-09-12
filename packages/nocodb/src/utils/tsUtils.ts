import {
  ncIsArray,
  ncIsNullOrUndefined,
  ncIsObject,
  ncIsString,
} from 'nocodb-sdk';

/**
 * Split array into chunks
 * @param array array to split
 * @param chunkSize size of each chunk
 * @returns
 **/

export function chunkArray<K>(
  array: Array<K>,
  chunkSize: number,
): Array<Array<K>> {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
}

/**
 * Validates and optionally stringifies a value to JSON format.
 * @template T - The type of the input value
 * @param {T} val - The value to validate and potentially stringify
 * @returns {{ jsonVal: string; isValidJson: boolean }} An object containing the processed value and validity flag
 * @description
 * - If input is a non-null object, converts it to a JSON string and marks as valid
 * - If input is a string, tests if it's valid JSON; keeps valid JSON as-is, invalid strings as-is
 * - For other types, returns value as-is with isValidJson false
 * @example
 * ```typescript
 * const result1 = validateAndStringifyJson({ name: "John" });
 * // Returns: { jsonVal: '{"name":"John"}', isValidJson: true }
 *
 * const result2 = validateAndStringifyJson('{"name":"John"}');
 * // Returns: { jsonVal: '{"name":"John"}', isValidJson: true }
 *
 * const result3 = validateAndStringifyJson("not json");
 * // Returns: { jsonVal: "not json", isValidJson: false }
 * ```
 */
export function validateAndStringifyJson<T>(val: T): {
  jsonVal: string;
  isValidJson: boolean;
} {
  let jsonVal: string;
  let isValidJson: boolean = false;

  if (typeof val === 'object' && val !== null) {
    jsonVal = JSON.stringify(val);
    isValidJson = true;
  } else if (typeof val === 'string') {
    try {
      JSON.parse(val as string);
      jsonVal = val as string;
      isValidJson = true;
    } catch (e) {
      jsonVal = val as string;
      isValidJson = false;
    }
  } else {
    // Handle other types (number, boolean, undefined, etc.)
    jsonVal = String(val);
    isValidJson = false;
  }

  return { jsonVal, isValidJson };
}

/**
 * Parse a JSON-backed value into a typed object. Handles the three shapes a
 * JSON column can arrive in:
 *   - already an object (e.g. after the meta layer's `prepareForResponse`
 *     parses the column) → returned as-is,
 *   - a JSON string (raw DB row) → `JSON.parse`d,
 *   - null / undefined / non-string primitive / unparseable → `fallback`.
 *
 * @template T - The expected shape of the parsed value.
 * @param {unknown} value - The value to parse (object, JSON string, or nullish).
 * @param {T} [fallback={}] - Returned when `value` is absent or not valid JSON.
 * @returns {T} The parsed value, or `fallback`.
 * @example
 * ```typescript
 * parseJson<{ a: number }>('{"a":1}');          // { a: 1 }
 * parseJson<{ a: number }>({ a: 1 });            // { a: 1 }
 * parseJson<string[]>(undefined, []);            // []
 * parseJson<{ a: number }>('not json');          // {}
 * ```
 */
export function parseJson<T = Record<string, unknown>>(
  value: unknown,
  fallback: T = {} as T,
): T {
  if (ncIsNullOrUndefined(value)) return fallback;
  // Already parsed (e.g. the meta layer's `prepareForResponse`) — object or array.
  if (ncIsObject(value) || ncIsArray(value)) return value as T;
  if (!ncIsString(value)) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export { pickFields, pickFieldsIfPresent } from 'nocodb-sdk';
