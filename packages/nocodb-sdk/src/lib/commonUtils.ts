import { ncIsEmptyObject, ncIsObject } from './is';

/**
 * Extracts properties from an object.
 * @param body - The object to extract properties from.
 * @param props - The properties to extract.
 * @param _throwError - Whether to throw an error if no properties are found.
 * @returns - The extracted properties.
 */
export function extractProps<T extends Record<string, any>>(
  body: T,
  props: string[],
  _throwError?: boolean
): Partial<T> {
  if (!ncIsObject(body)) return {};

  // todo: throw error if no props found
  return props.reduce((o, key) => {
    if (key in body && body[key] !== undefined) o[key] = body[key];
    return o;
  }, {});
}

/**
 * Removes all `undefined` values and empty objects (`{}`) from an object.
 * Can optionally run recursively with the `deep` flag.
 *
 * - Works only on plain objects (`ncIsObject`).
 * - Arrays are preserved as-is (including `undefined` entries).
 * - Empty objects are always removed if they occur as object values.
 *
 * @typeParam T - Type of the input value.
 * @param obj - The object or value to clean.
 * @param deep - If `true`, cleans recursively. If `false`, cleans only top-level. Defaults to `true`.
 * @returns A cleaned copy of `obj`.
 *
 * @example
 * ```ts
 * const data = {
 *   a: 1,
 *   b: undefined,
 *   c: { d: 2, e: undefined, f: { g: undefined } },
 *   arr: [1, undefined, { x: undefined, y: 5 }]
 * }
 *
 * removeUndefinedFromObj(data)
 * // → { a: 1, c: { d: 2 }, arr: [1, undefined, { y: 5 }] }
 *
 * removeUndefinedFromObj(data, false)
 * // → { a: 1, c: { d: 2, f: { g: undefined } }, arr: [1, undefined, { x: undefined, y: 5 }] }
 * ```
 */
export const removeUndefinedFromObj = <T>(obj: T, deep = true): T => {
  if (ncIsObject(obj)) {
    const cleanedEntries = Object.entries(obj)
      .map(([k, v]) => {
        const cleanedValue =
          deep && (ncIsObject(v) || Array.isArray(v))
            ? removeUndefinedFromObj(v, deep)
            : v;
        return [k, cleanedValue] as const;
      })
      .filter(([_, v]) => {
        if (v === undefined) return false;
        if (ncIsObject(v) && !Array.isArray(v) && ncIsEmptyObject(v))
          return false;
        return true;
      });

    return Object.keys(cleanedEntries).reduce((obj, key) => {
      (obj as any)[key] = (cleanedEntries as any)[key];
      return obj;
    }, {} as T);
  }

  return obj;
};
