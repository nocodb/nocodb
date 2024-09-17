/**
 * Checks if a value is an object (excluding null).
 *
 * @param value - The value to check.
 * @returns {boolean} - True if the value is an object, false otherwise.
 *
 * @example
 * ```typescript
 * const value = { key: 'value' };
 * console.log(isObject(value)); // true
 * ```
 */
export function isObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !isArray(value)
}

export function isEmptyObject(value: any): boolean {
  return isObject(value) && Object.keys(value).length === 0
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
 * console.log(isArray(value)); // true
 * ```
 */
export function isArray(value: any): boolean {
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
 * console.log(isEmptyArray(value)); // true
 *
 * const nonEmptyArray = [1, 2, 3];
 * console.log(isEmptyArray(nonEmptyArray)); // false
 * ```
 */
export function isEmptyArray(value: any): boolean {
  return isArray(value) && value.length === 0
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
 * console.log(isString(value)); // true
 * ```
 */
export function isString(value: any): boolean {
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
 * console.log(isNumber(value)); // true
 * ```
 */
export function isNumber(value: any): boolean {
  return typeof value === 'number' && !isNaN(value)
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
 * console.log(isBoolean(value)); // true
 * ```
 */
export function isBoolean(value: any): boolean {
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
 * console.log(isUndefined(value)); // true
 * ```
 */
export function isUndefined(value: any): boolean {
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
 * console.log(isNull(value)); // true
 * ```
 */
export function isNull(value: any): boolean {
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
 * console.log(isFunction(value)); // true
 * ```
 */
export function isFunction(value: any): boolean {
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
 * console.log(isPromise(value)); // true
 * ```
 */
export function isPromise(value: any): boolean {
  return value instanceof Promise
}
