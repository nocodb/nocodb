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
  contextExtraction?: (args: TArgs) => NcContext | undefined;
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
}

/**
 * NcCache decorator - enables per-request in-memory caching
 * Cache is only active when context.cache === true
 * Cache is stored directly on context.cacheMap for per-request/operation scope
 *
 * Usage examples:
 *
 * 1. With explicit tuple type (recommended for static methods):
 * @NcCache<[NcContext, string, any?]>({
 *   key: (args) => `Model.get:${args[1]}`,
 *   contextExtraction: (args) => args[0],
 * })
 *
 * 2. With Parameters utility type (for instance methods or when method is already defined):
 * type GetMethodArgs = Parameters<typeof Model.get>;
 * @NcCache<GetMethodArgs>({
 *   key: (args) => `Model.get:${args[1]}`,
 *   contextExtraction: (args) => args[0],
 * })
 *
 * 3. Without type parameter (uses any[] - less type-safe):
 * @NcCache({
 *   key: (args) => `Model.get:${args[1]}`,
 *   contextExtraction: (args) => args[0],
 * })
 */
export function NcCache<TArgs extends any[] = any[]>(
  options: NcCacheOptions<TArgs> | NcCacheOptionsAny,
): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Extract context using provided function or default to first argument
      const context: NcContext | undefined = options.contextExtraction
        ? options.contextExtraction(args as TArgs)
        : args[0];

      // If no context or cache is not enabled, execute method normally
      if (!context || context.cache !== true) {
        return originalMethod.apply(this, args);
      }

      // Initialize cache map on context if it doesn't exist
      if (!context.cacheMap) {
        context.cacheMap = new Map<string, any>();
      }

      // Generate cache key
      // For static methods, 'this' is the constructor; for instance methods, 'this' is the instance
      const cacheKey =
        typeof options.key === 'function'
          ? options.key(args as TArgs, this, propertyKey)
          : options.key;

      // Check if value is cached
      if (context.cacheMap.has(cacheKey)) {
        return context.cacheMap.get(cacheKey);
      }

      // Execute method and cache result
      const result = await originalMethod.apply(this, args);

      // Store result in cache
      context.cacheMap.set(cacheKey, result);

      return result;
    };

    return descriptor;
  };
}
