/**
 * Generic type that represents a primitive value or an object with nested properties
 * of the same type.
 */
interface NestedObject {
  [key: string]: NestedValue
}

type NestedValue = string | number | boolean | Date | NestedObject | NestedValue[] | null | undefined

/**
 * Performs a case-insensitive global search through all properties of objects in an array.
 * Searches through all nested properties automatically.
 * Supports '%' for matching zero or more characters and '_' for matching exactly one character.
 *
 * @template T - Type of objects in the array, must extend NestedObject
 * @param {T[]} array - The array of objects to search through
 * @param {string} pattern - The search pattern using SQL LIKE syntax (e.g., '%test%', 'test%', '%test')
 * @returns {T[]} - Array of objects that have at least one matching value
 *
 * @example
 * interface User {
 *   name: string;
 *   user: {
 *     address: { city: string };
 *     contact: { email: string };
 *   };
 * }
 *
 * const data: User[] = [
 *   {
 *     name: 'John Doe',
 *     user: {
 *       address: { city: 'New York' },
 *       contact: { email: 'john@example.com' }
 *     }
 *   }
 * ];
 *
 * // Will search through all properties including nested ones
 * searchLike(data, '%john%'); // Will match against name and email
 */
export function searchLike<T extends NestedObject>(array: T[], pattern: string): T[] {
  // Input validation
  if (!Array.isArray(array)) {
    throw new TypeError('First argument must be an array')
  }
  if (typeof pattern !== 'string') {
    throw new TypeError('Second argument must be a string (search pattern)')
  }

  // Convert SQL LIKE pattern to JavaScript RegExp
  const regexPattern = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
    .replace(/%/g, '.*') // % matches zero or more characters
    .replace(/_/g, '.') // _ matches exactly one character

  const regex = new RegExp(regexPattern, 'i') // 'i' flag for case-insensitive

  /**
   * Recursively searches through all properties of an object
   * @param {NestedValue} obj - The object or value to search through
   * @returns {boolean} True if a match is found in any property
   */
  function searchRecursive(obj: NestedValue): boolean {
    // Handle null or undefined
    if (obj === null || obj === undefined) {
      return false
    }

    // Handle primitive values
    if (typeof obj !== 'object') {
      return regex.test(String(obj))
    }

    // Handle Date objects
    if (obj instanceof Date) {
      return regex.test(obj.toISOString())
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.some((item) => searchRecursive(item))
    }

    // Handle objects
    return Object.values(obj).some((value) => searchRecursive(value))
  }

  // Filter the array based on the pattern
  return array.filter((item) => searchRecursive(item))
}
