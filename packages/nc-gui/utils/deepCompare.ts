/**
 * Performs a deep comparison between two values to determine if they are equal.
 *
 * This function recursively compares:
 * - Primitives (`string`, `number`, `boolean`, `null`, `undefined`)
 * - Arrays (including nested arrays)
 * - Plain objects (nested objects included)
 *
 * It uses the original object iteration style (`for...in` with `in` check)
 * to preserve compatibility with existing code.
 *
 * @param a - The first value to compare. Can be any type (primitive, array, or object).
 * @param b - The second value to compare. Can be any type (primitive, array, or object).
 * @returns `true` if both values are deeply equal, otherwise `false`.
 *
 * @example
 * ```ts
 * deepCompare(1, 1); // true
 * deepCompare([1, 2], [1, 2]); // true
 * deepCompare({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] }); // true
 * deepCompare({ a: 1 }, { a: 2 }); // false
 * deepCompare(null, null); // true
 * ```
 */
export const deepCompare = (a: any, b: any) => {
  if (a === b) return true

  // Handle null
  if (a === null || b === null) return false

  // Type mismatch
  if (typeof a !== typeof b) return false

  // Primitives
  if (typeof a !== 'object') return a === b

  // Arrays
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepCompare(a[i], b[i])) return false
    }
    return true
  }

  // Plain objects
  if (Object.keys(a).length !== Object.keys(b).length) return false

  for (const k in a) {
    if (!(k in b)) return false
    if (!deepCompare(a[k], b[k])) return false
  }
  return true
}
