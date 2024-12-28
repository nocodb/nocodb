/**
 * Checks if a value is an object (excluding null).
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is an object, false otherwise.
 *
 * @example
 * ```typescript
 * const value = { key: 'value' };
 * console.log(ncIsObject(value)); // true
 * ```
 */
export function ncIsObject(value: any): value is object {
  return value !== null && typeof value === 'object' && !ncIsArray(value)
}

/**
 * Checks if a value is an empty object.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is an empty object, false otherwise.
 *
 * @example
 * ```typescript
 * const value = {};
 * console.log(ncIsEmptyObject(value)); // true
 * ```
 */
export function ncIsEmptyObject(value: any): boolean {
  return ncIsObject(value) && Object.keys(value).length === 0
}

/**
 * Checks if a value is an array.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is an array, false otherwise.
 *
 * @example
 * ```typescript
 * const value = [1, 2, 3];
 * console.log(ncIsArray(value)); // true
 * ```
 */
export function ncIsArray(value: any): value is any[] {
  return Array.isArray(value)
}

/**
 * Checks if a value is an empty array.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is an empty array, false otherwise.
 *
 * @example
 * ```typescript
 * const value = [];
 * console.log(ncIsEmptyArray(value)); // true
 *
 * const nonEmptyArray = [1, 2, 3];
 * console.log(ncIsEmptyArray(nonEmptyArray)); // false
 * ```
 */
export function ncIsEmptyArray(value: any): boolean {
  return ncIsArray(value) && value.length === 0
}

/**
 * Checks if a value is a string.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is a string, false otherwise.
 *
 * @example
 * ```typescript
 * const value = 'Hello, world!';
 * console.log(ncIsString(value)); // true
 * ```
 */
export function ncIsString(value: any): value is string {
  return typeof value === 'string'
}

/**
 * Checks if a value is a number.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is a number, false otherwise.
 *
 * @example
 * ```typescript
 * const value = 42;
 * console.log(ncIsNumber(value)); // true
 * ```
 */
export function ncIsNumber(value: any): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

/**
 * Checks if a value is a boolean.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is a boolean, false otherwise.
 *
 * @example
 * ```typescript
 * const value = true;
 * console.log(ncIsBoolean(value)); // true
 * ```
 */
export function ncIsBoolean(value: any): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Checks if a value is undefined.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is undefined, false otherwise.
 *
 * @example
 * ```typescript
 * const value = undefined;
 * console.log(ncIsUndefined(value)); // true
 * ```
 */
export function ncIsUndefined(value: any): value is undefined {
  return typeof value === 'undefined'
}

/**
 * Checks if a value is null.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is null, false otherwise.
 *
 * @example
 * ```typescript
 * const value = null;
 * console.log(ncIsNull(value)); // true
 * ```
 */
export function ncIsNull(value: any): value is null {
  return value === null
}

/**
 * Checks if a value is a function.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is a function, false otherwise.
 *
 * @example
 * ```typescript
 * const value = () => {};
 * console.log(ncIsFunction(value)); // true
 * ```
 */
export function ncIsFunction(value: any): value is Function {
  return typeof value === 'function'
}

/**
 * Checks if a value is a promise.
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is a Promise, false otherwise.
 *
 * @example
 * ```typescript
 * const value = new Promise((resolve) => resolve(true));
 * console.log(ncIsPromise(value)); // true
 * ```
 */
export function ncIsPromise(value: any): boolean {
  return value instanceof Promise
}

/**
 * Checks whether an array includes a specific value.
 *
 * If an `objectKey` is provided and the array consists of objects, it will check
 * whether the value of the specified `objectKey` in any object matches the given value.
 *
 * @param {T[]} array - The array to check.
 * @param {any} value - The value to search for in the array.
 * @param {keyof T} [objectKey] - The key to check in objects, if the array contains objects.
 *
 * @returns {boolean} - Returns `true` if the value or object with matching `objectKey` is found, otherwise `false`.
 *
 * @example
 * // For primitive arrays
 * ncIsArrayIncludes([1, 2, 3], 2) // true
 *
 * // For arrays with objects
 * ncIsArrayIncludes([{ id: 1 }, { id: 2 }], 2, 'id') // true
 */
export function ncIsArrayIncludes<T>(array: T[] = [], value: any, objectKey?: keyof T): boolean {
  if (!ncIsArray(array) || !array.length) return false

  if (objectKey && ncIsObject(array[0])) {
    return array.some((item) => item[objectKey] === value)
  }

  return array.includes(value)
}
