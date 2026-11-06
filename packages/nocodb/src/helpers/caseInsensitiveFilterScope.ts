import { AsyncLocalStorage } from 'node:async_hooks';

const scope = new AsyncLocalStorage<true>();

/**
 * Run `fn` in a scope where conditionV2 honours `Filter.case_insensitive`.
 *
 * Outside it the flag is ignored, so a caller of any other API cannot opt in
 * by putting it in `filterArrJson`.
 */
export const runWithCaseInsensitiveFilters = <T>(
  fn: () => Promise<T>,
): Promise<T> => scope.run(true, fn);

export const allowsCaseInsensitiveFilters = (): boolean =>
  scope.getStore() === true;
