// Search indexes are EE; EE shadows this file.

export function runWithSearchIndexDeferred<T>(
  _modelIds: string[],
  fn: () => Promise<T>,
): Promise<T> {
  return fn();
}
