import type { NcContext } from 'nocodb-sdk';

/**
 * Helper type to extract parameter types from a function
 */
export type ExtractArgs<T> = T extends (...args: infer P) => any ? P : never;

/**
 * Type-safe cache options that can infer function parameter types
 */
export interface NcCacheOptions<TArgs extends any[] = any[]> {
  /**
   * Cache key - can be a string or a function that generates the key
   * Function receives typed arguments from the decorated method
   */
  key:
    | string
    | ((args: TArgs, target: any, propertyKey: string | symbol) => string);
  /**
   * Optional function to extract context from function arguments
   * If not provided, assumes first argument is the context
   * Function receives typed arguments from the decorated method
   */
  contextExtraction?: (args: TArgs, thisArg: this) => NcContext | undefined;
  /**
   * Optional callback that runs only when the result is retrieved from cache
   * Function receives typed arguments, the cached result, and the this context
   */
  onCacheHit?: (
    args: TArgs,
    result: any,
    thisArg: this,
  ) => void | Promise<void>;
}

/**
 * Non-generic version for backward compatibility and when types can't be inferred
 */
export interface NcCacheOptionsAny {
  /**
   * Cache key - can be a string or a function that generates the key
   * Function receives: (args: any[], target: any, propertyKey: string | symbol) => string
   */
  key:
    | string
    | ((args: any[], target: any, propertyKey: string | symbol) => string);
  /**
   * Optional function to extract context from function arguments
   * If not provided, assumes first argument is the context
   * Function receives: (args: any[]) => NcContext | undefined
   */
  contextExtraction?: (args: any[]) => NcContext | undefined;
  /**
   * Optional callback that runs only when the result is retrieved from cache
   * Function receives arguments, the cached result, and the this context
   */
  onCacheHit?: (args: any[], result: any, thisArg: any) => void | Promise<void>;
}

/**
 * NcCache decorator - placeholder implementation
 */
export function NcCache<TArgs extends any[] = any[]>(
  _options: NcCacheOptions<TArgs> | NcCacheOptionsAny,
): MethodDecorator {
  return (
    _target: any,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    return descriptor;
  };
}
