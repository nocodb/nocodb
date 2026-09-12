import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-async-chain call depth for `postProcessData`'s relation re-resolution.
 *
 * `postProcessData` re-resolves a relation's virtual columns (lookups) via
 * `nocoExecute`, which reads further relations. That recursion must be bounded
 * so a self-referential / cyclic lookup chain terminates.
 *
 * The depth CANNOT live on the request-shared `context.cacheMap`: `nocoExecute`
 * fires field resolvers concurrently (DataLoader-batched per relation), so
 * sibling relation reads run as PARALLEL async chains, not a call stack. A
 * single shared counter is then read across an `await` by a sibling (which may
 * observe another chain's incremented value and wrongly skip expansion) and
 * left stranded by out-of-order completion (a `finally` that restores the
 * captured value rather than decrementing).
 *
 * `AsyncLocalStorage` gives each async chain its own depth and restores it
 * automatically as the chain unwinds, so concurrent siblings never observe each
 * other's depth. Same pattern as `src/cache/cacheBypassScope.ts`.
 */
const scope = new AsyncLocalStorage<number>();

/** Current relation-read depth for this async chain (0 at the top level). */
export const getRelationReadDepth = (): number => scope.getStore() ?? 0;

/** Run `fn` one relation-read level deeper than the current async chain. */
export const runAtNextRelationReadDepth = <T>(
  fn: () => Promise<T>,
): Promise<T> => scope.run(getRelationReadDepth() + 1, fn);
