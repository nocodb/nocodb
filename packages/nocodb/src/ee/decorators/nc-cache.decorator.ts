import type { NcContext } from 'nocodb-sdk';
import type {
  NcCacheOptions,
  NcCacheOptionsAny,
} from 'src/decorators/nc-cache.decorator';

// Re-export types for convenience
export type {
  NcCacheOptions,
  NcCacheOptionsAny,
} from 'src/decorators/nc-cache.decorator';

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
 *
 * 4. With cache hit callback:
 * @NcCache<[NcContext, string, any?]>({
 *   key: (args) => `Model.get:${args[1]}`,
 *   contextExtraction: (args) => args[0],
 *   onCacheHit: (args, result, thisArg) => {
 *     console.log('Cache hit for args:', args, 'result:', result);
 *   },
 * })
 *
 * 5. With skipIf condition (function):
 * @NcCache<[NcContext, string, any?]>({
 *   key: (args) => `Model.get:${args[1]}`,
 *   contextExtraction: (args) => args[0],
 *   skipIf: (args) => args[1] === 'skip-me', // Skip caching for specific arguments
 * })
 *
 * 6. With skipIf condition (RegExp):
 * @NcCache<[NcContext, string, any?]>({
 *   key: (args) => `Model.get:${args[1]}`,
 *   contextExtraction: (args) => args[0],
 *   skipIf: /^Model\.get:temp/, // Skip caching if key matches pattern
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

    // Generate static part of cache key prefix outside wrapper function
    // (className:functionName:) - base_id will be appended at runtime
    let defaultPrefixBase: string | null = null;
    if (!options.keyPrefix) {
      // Determine class name
      let className: string;
      // For static methods, 'target' is the constructor function
      // For instance methods, 'target' is the prototype
      if (typeof target === 'function') {
        // Static method - target is the constructor
        className = target.name || 'root';
      } else if (
        target &&
        target.constructor &&
        typeof target.constructor === 'function'
      ) {
        // Instance method - get constructor name from prototype's constructor
        className = target.constructor.name || 'root';
      } else {
        // Fallback to 'root' if not within a class
        className = 'root';
      }
      const functionName = String(propertyKey);
      defaultPrefixBase = `${className}:${functionName}:`;
    }

    descriptor.value = async function (...args: any[]) {
      // Extract context using provided function or default to first argument
      let context: NcContext | undefined;
      if (options.contextExtraction) {
        context = options.contextExtraction(args as TArgs, this);
      } else if (args.length > 0 && args[0]) {
        // Check if first argument looks like a valid NcContext
        const firstArg = args[0];
        if (
          typeof firstArg === 'object' &&
          (firstArg.base_id !== undefined ||
            firstArg.workspace_id !== undefined)
        ) {
          context = firstArg as NcContext;
        }
      }

      // If no context or cache is not enabled, execute method normally
      if (!context || context.cache !== true) {
        return originalMethod.apply(this, args);
      }

      // Initialize cache map on context if it doesn't exist
      if (!context.cacheMap) {
        // todo: make it non-enumerable, keeping it as enumerable for now to support spread operator
        // Object.defineProperty(context, 'cacheMap', {
        //   value: new Map<string, any>(),
        //   enumerable: false,
        //   writable: true,
        //   configurable: true,
        // });
        context.cacheMap = new Map<string, any>();
      }

      // Generate cache key prefix
      let keyPrefix = options.keyPrefix;
      if (!keyPrefix && defaultPrefixBase !== null) {
        // Append base_id to the pre-computed prefix base
        const baseId = context.base_id || '';
        keyPrefix = `${defaultPrefixBase}${baseId}:`;
      }

      // Generate cache key
      // For static methods, 'this' is the constructor; for instance methods, 'this' is the instance
      const userKey =
        typeof options.key === 'function'
          ? options.key(args as TArgs, this, propertyKey)
          : options.key;

      // Combine prefix with user key
      const cacheKey = keyPrefix + userKey;

      // Check skipIf condition
      let shouldSkip = false;
      if (options.skipIf !== undefined) {
        if (options.skipIf instanceof RegExp) {
          shouldSkip = options.skipIf.test(cacheKey);
        } else if (typeof options.skipIf === 'function') {
          shouldSkip = await options.skipIf(args as TArgs, this);
        }
      }

      // If skipIf condition is true, execute method without caching
      if (shouldSkip) {
        return originalMethod.apply(this, args);
      }

      // Check if value is cached
      if (context.cacheMap.has(cacheKey)) {
        const cachedResult = context.cacheMap.get(cacheKey);
        // Run cache hit callback if provided
        if (options.onCacheHit) {
          await options.onCacheHit(args as TArgs, await cachedResult, this);
        }
        return await cachedResult;
      }

      // Execute method and cache result
      const resultPromise = originalMethod.apply(this, args);

      // Store result in cache
      context.cacheMap.set(cacheKey, resultPromise);

      return await resultPromise;
    };

    return descriptor;
  };
}
