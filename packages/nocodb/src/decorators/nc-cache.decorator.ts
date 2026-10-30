import { AsyncLocalStorage } from 'node:async_hooks';
import type { NcContext } from 'nocodb-sdk';

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
   * Optional key prefix. If not provided, will be auto-generated as:
   * className + ':' + functionName + ':' + context.base_id + ':'
   * For static methods, className is the constructor name.
   * For instance methods, className is the instance's constructor name.
   * If not within a class, uses 'root' as className.
   */
  keyPrefix?: string;
  /**
   * Optional function to extract context from function arguments
   * If not provided, defaults to first argument if it looks like a valid NcContext
   * (has base_id or workspace_id property)
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
  /**
   * Optional condition to skip caching. If the condition is true, the method will execute without caching.
   * Can be:
   * - A function: receives typed arguments and this context, returns boolean or Promise<boolean>
   * - A RegExp: if the generated cache key matches the regex, skip caching
   */
  skipIf?:
    | ((args: TArgs, thisArg: this) => boolean | Promise<boolean>)
    | RegExp;
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
   * Optional key prefix. If not provided, will be auto-generated as:
   * className + ':' + functionName + ':' + context.base_id + ':'
   * For static methods, className is the constructor name.
   * For instance methods, className is the instance's constructor name.
   * If not within a class, uses 'root' as className.
   */
  keyPrefix?: string;
  /**
   * Optional function to extract context from function arguments
   * If not provided, defaults to first argument if it looks like a valid NcContext
   * (has base_id or workspace_id property)
   * Function receives: (args: any[]) => NcContext | undefined
   */
  contextExtraction?: (args: any[]) => NcContext | undefined;
  /**
   * Optional callback that runs only when the result is retrieved from cache
   * Function receives arguments, the cached result, and the this context
   */
  onCacheHit?: (args: any[], result: any, thisArg: any) => void | Promise<void>;
  /**
   * Optional condition to skip caching. If the condition is true, the method will execute without caching.
   * Can be:
   * - A function: receives arguments and this context, returns boolean or Promise<boolean>
   * - A RegExp: if the generated cache key matches the regex, skip caching
   */
  skipIf?: ((args: any[], thisArg: any) => boolean | Promise<boolean>) | RegExp;
}

/**
 * Per-request memoization store.
 *
 * Holds promises rather than resolved values, so concurrent callers of the same
 * key collapse onto a single in-flight call instead of each starting their own.
 */
const store = new AsyncLocalStorage<Map<string, Promise<any>>>();

/**
 * Run `fn` with a fresh request-scoped cache.
 *
 * Outside of this scope every `@NcCache` decorated method behaves exactly as if
 * undecorated, so adding the scope is what turns memoization on. The map is
 * discarded when `fn` settles, which is what keeps the memoization safe: nothing
 * survives into the next request, so there is no cross-request staleness and no
 * new invalidation path to get wrong.
 *
 * Mirrors `~/cache/cacheBypassScope`, which already uses AsyncLocalStorage for a
 * per-async-tree scope: concurrent requests outside the scope are unaffected and
 * nesting is a safe no-op (the inner scope simply gets its own map).
 */
export const runWithRequestCache = <T>(fn: () => T): T =>
  store.run(new Map(), fn);

/** Whether the current async context has a request-scoped cache. */
export const isRequestCacheActive = (): boolean =>
  store.getStore() !== undefined;

const looksLikeContext = (value: any): value is NcContext =>
  !!value &&
  typeof value === 'object' &&
  ('base_id' in value || 'workspace_id' in value);

const isThenable = (value: any): value is Promise<any> =>
  !!value && typeof value.then === 'function';

/**
 * NcCache decorator — memoizes a method for the duration of one request.
 *
 * Metadata reads dominate some request paths: a single record update on a wide
 * table can fetch the same `nc_columns_v2` entry hundreds of times, once per
 * evaluation that needs the column definition. The data is immutable for the
 * duration of the request, so the repeat lookups are pure overhead — each one a
 * round trip to the cache backend.
 *
 * Only the decorator body lives here; the call sites are already annotated.
 */
export function NcCache<TArgs extends any[] = any[]>(
  options: NcCacheOptions<TArgs> | NcCacheOptionsAny,
): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const original = descriptor.value;

    // Only methods are wrapped. A getter or a property reaching this decorator
    // is left exactly as it was rather than silently breaking.
    if (typeof original !== 'function') {
      return descriptor;
    }

    descriptor.value = async function (this: any, ...args: any[]) {
      const cache = store.getStore();

      // No scope: behave as if undecorated. This is what makes the change safe
      // to land before every entry point opens a scope — background jobs, CLI
      // paths and tests keep their current behaviour untouched.
      if (!cache) {
        return original.apply(this, args);
      }

      const { key, keyPrefix, contextExtraction, onCacheHit, skipIf } =
        options as NcCacheOptionsAny;

      const keyPart =
        typeof key === 'function' ? key(args, target, propertyKey) : key;

      let prefix = keyPrefix;
      if (prefix === undefined) {
        // Documented default: className + ':' + functionName + ':' + base_id.
        // `target` is the prototype for instance methods and the constructor
        // for static ones, hence the two ways of reaching the class name.
        const className =
          target?.name ?? target?.constructor?.name ?? this?.constructor?.name;
        let context: NcContext | undefined;
        try {
          context = contextExtraction
            ? (contextExtraction as any)(args, this)
            : looksLikeContext(args[0])
              ? args[0]
              : undefined;
        } catch {
          // A throwing extractor must not break the call it was only meant to
          // describe; fall back to a prefix without the base id.
          context = undefined;
        }
        prefix = `${className ?? 'root'}:${String(propertyKey)}:${
          context?.base_id ?? ''
        }`;
      }

      const cacheKey = `${prefix}:${keyPart}`;

      if (skipIf instanceof RegExp) {
        if (skipIf.test(cacheKey)) {
          return original.apply(this, args);
        }
      } else if (typeof skipIf === 'function') {
        if (await (skipIf as any)(args, this)) {
          return original.apply(this, args);
        }
      }

      if (cache.has(cacheKey)) {
        const result = await cache.get(cacheKey);
        // `onCacheHit` exists because some call sites rely on the method's side
        // effect, not only its return value — `Column.getColOptions` assigns
        // `thisArg.colOptions`. Without this the second caller would get the
        // right value back and an unpopulated instance.
        await onCacheHit?.(args, result, this);
        return result;
      }

      const pending = original.apply(this, args);

      // A synchronous return value is handed back untouched: memoizing it would
      // mean storing a non-promise in a promise map, and nothing in the codebase
      // decorates synchronous methods today.
      if (!isThenable(pending)) {
        return pending;
      }

      cache.set(cacheKey, pending);

      // A rejection must not be remembered: leaving it in the map would make one
      // transient failure poison every later lookup of the same key within the
      // request. The catch is attached only to clean up — the original rejection
      // still propagates to the caller.
      pending.catch(() => {
        if (cache.get(cacheKey) === pending) {
          cache.delete(cacheKey);
        }
      });

      return pending;
    };

    return descriptor;
  };
}
