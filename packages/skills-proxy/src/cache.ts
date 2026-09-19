import { CACHE_MAX_ENTRIES, STALE_SECONDS } from './config.js';

/**
 * TTL cache with single-flight and serve-stale-on-error, all three guarding the
 * one 600/min skills.sh budget shared by every NocoDB instance.
 *
 * In-memory and per-instance, so the effective upstream rate is this times the
 * instance count — and a flush only clears the instance that served it.
 */

interface Entry<T> {
  value: T;
  freshUntil: number;
  /** Epoch ms after which it is not servable even as a fallback. */
  staleUntil: number;
}

const entries = new Map<string, Entry<unknown>>();

const inFlight = new Map<string, Promise<unknown>>();

/** Bumped by every drop, so a load started before a flush cannot undo it. */
let generation = 0;

export interface CacheResult<T> {
  value: T;
  /** True when upstream failed and a past value was served instead. */
  stale: boolean;
}

/** Insertion order is LRU-ish enough: `write` re-inserts, so the oldest is the coldest. */
function evictIfNeeded() {
  while (entries.size > CACHE_MAX_ENTRIES) {
    const oldest = entries.keys().next();
    if (oldest.done) return;
    entries.delete(oldest.value);
  }
}

function read<T>(key: string): Entry<T> | undefined {
  const entry = entries.get(key) as Entry<T> | undefined;
  if (!entry) return undefined;

  if (Date.now() > entry.staleUntil) {
    entries.delete(key);
    return undefined;
  }

  return entry;
}

function write<T>(key: string, value: T, ttlSeconds: number) {
  const now = Date.now();

  entries.delete(key);
  entries.set(key, {
    value,
    freshUntil: now + ttlSeconds * 1000,
    staleUntil: now + STALE_SECONDS * 1000,
  });

  evictIfNeeded();
}

/**
 * Serve `key` from cache, or call `load` once for every concurrent caller.
 *
 * A failing `load` is not cached: the next caller retries, unless there is a
 * past value, in which case they get that and the error is swallowed.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<CacheResult<T>> {
  const entry = read<T>(key);

  if (entry && Date.now() < entry.freshUntil) {
    return { value: entry.value, stale: false };
  }

  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) {
    try {
      return { value: await existing, stale: false };
    } catch (e) {
      if (entry) return { value: entry.value, stale: true };
      throw e;
    }
  }

  const startedAt = generation;

  const request = load()
    .then((value) => {
      if (generation === startedAt) write(key, value, ttlSeconds);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);

  try {
    return { value: await request, stale: false };
  } catch (e) {
    if (entry) return { value: entry.value, stale: true };
    throw e;
  }
}

export function cacheSize(): number {
  return entries.size;
}

export interface CacheEntryInfo {
  key: string;
  /** False once past the TTL: still servable, but only if upstream fails. */
  fresh: boolean;
  ageSeconds: number;
  freshForSeconds: number;
  staleForSeconds: number;
}

/** Keys only — values can be megabytes. */
export function cacheEntries(prefix?: string): CacheEntryInfo[] {
  const now = Date.now();
  const out: CacheEntryInfo[] = [];

  for (const [key, entry] of entries) {
    if (prefix && !key.startsWith(prefix)) continue;

    out.push({
      key,
      fresh: now < entry.freshUntil,
      ageSeconds: Math.round(
        (now - (entry.staleUntil - STALE_SECONDS * 1000)) / 1000,
      ),
      freshForSeconds: Math.max(0, Math.round((entry.freshUntil - now) / 1000)),
      staleForSeconds: Math.max(0, Math.round((entry.staleUntil - now) / 1000)),
    });
  }

  return out;
}

/**
 * Drop cached values, optionally only those under `prefix`. Returns how many.
 *
 * In-flight loads still resolve for the callers waiting on them; the generation
 * bump only stops their results being written.
 */
export function dropCache(prefix?: string): number {
  generation += 1;

  if (!prefix) {
    const dropped = entries.size;
    entries.clear();
    return dropped;
  }

  let dropped = 0;

  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) {
      entries.delete(key);
      dropped += 1;
    }
  }

  return dropped;
}

export function clearCache() {
  generation += 1;
  entries.clear();
  inFlight.clear();
}
