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
 * Type-preserving `Pick`. Iterates a typed key list and copies each value
 * across — keeps the source's property types (no `as unknown` widening).
 *
 * Why a helper: writing `out[k] = src[k]` inline with `k: K1 | K2 | ...`
 * trips TS — the LHS write type collapses to the intersection of value
 * types (often `never`). Inside this helper K is a single bound type
 * variable, so `out[k]` and `obj[k]` resolve to the same `T[K]`.
 */
export function pickFields<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}

/**
 * Like `pickFields`, but only copies keys that are present in `presence`.
 * Used for snapshot-update flows where the inverse should restore only the
 * fields the forward call actually mutated.
 */
export function pickFieldsIfPresent<
  T extends object,
  K extends keyof T,
  P extends object,
>(obj: T, keys: readonly K[], presence: P): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const k of keys) {
    if (k in presence) out[k] = obj[k];
  }
  return out;
}
