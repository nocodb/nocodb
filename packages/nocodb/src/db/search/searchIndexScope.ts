import { AsyncLocalStorage } from 'node:async_hooks';

const scope = new AsyncLocalStorage<ReadonlySet<string>>();

/**
 * Run `fn` with its own writes to `modelIds` left untracked and their field
 * builds left unqueued: the caller re-indexes what it wrote once `fn` ends.
 * Writes outside `fn`'s async tree are tracked as usual.
 */
export function runWithSearchIndexDeferred<T>(
  modelIds: string[],
  fn: () => Promise<T>,
): Promise<T> {
  return scope.run(new Set(modelIds), fn);
}

export function isSearchIndexDeferred(modelId: string) {
  return scope.getStore()?.has(modelId) ?? false;
}
