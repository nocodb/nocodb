/**
 * Split array into chunks
 * @param array array to split
 * @param chunkSize size of each chunk
 * @returns
 **/

export function chunkArray<K>(
  array: Array<K>,
  chunkSize: number,
): Array<Array<K>> {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }

  return chunks;
}
