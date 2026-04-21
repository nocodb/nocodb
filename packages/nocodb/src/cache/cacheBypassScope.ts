import { AsyncLocalStorage } from 'node:async_hooks';

const scope = new AsyncLocalStorage<true>();

/**
 * Run `fn` in a scope where NocoCache read/write ops are bypassed.
 *
 * Inside the scope, `get`/`getList`/`getHash`/`getHashField` return empty
 * values and `set`/`setList`/`setExpiring`/`setHash`/`setHashField`/
 * `appendToList`/`update` are no-ops — as if the cache were disabled.
 * Invalidation ops (`del`/`deepDel`/`delHashField`/`clear`) and counters
 * (`incrby`/`incrHashField`) pass through unchanged.
 *
 * Intended for use inside DB transactions where cache reads would return
 * stale pre-transaction state and cache writes would leak uncommitted
 * transaction-local data into the shared cache.
 *
 * The scope is per-async-tree via AsyncLocalStorage: concurrent requests
 * outside the scope are unaffected. Nested calls are a safe no-op.
 */
export const runWithoutCache = <T>(fn: () => Promise<T>): Promise<T> =>
  scope.run(true, fn);

export const isCacheBypassed = (): boolean => scope.getStore() === true;
