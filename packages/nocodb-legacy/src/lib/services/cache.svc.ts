import NocoCache from '../cache/NocoCache';

export async function cacheGet() {
  return await NocoCache.export();
}

export async function cacheDelete() {
  await NocoCache.destroy();
  return true;
}
