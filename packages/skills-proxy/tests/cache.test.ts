import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  cacheEntries,
  cacheSize,
  cached,
  clearCache,
  dropCache,
} from '../src/cache.js';

describe('cache', () => {
  afterEach(clearCache);

  it('serves a hit without calling the loader again', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      return 'v';
    };

    await cached('k', 60, load);
    const second = await cached('k', 60, load);

    assert.equal(calls, 1);
    assert.equal(second.value, 'v');
    assert.equal(second.stale, false);
  });

  it('collapses concurrent misses into one upstream call', async () => {
    let calls = 0;
    const load = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return calls;
    };

    const results = await Promise.all(
      Array.from({ length: 50 }, () => cached('herd', 60, load)),
    );

    assert.equal(calls, 1);
    assert.deepEqual(new Set(results.map((r) => r.value)), new Set([1]));
  });

  it('serves the last good value when the loader fails', async () => {
    await cached('k', 0, async () => 'good');

    // ttl 0 means the next read is a miss, so the failing loader runs.
    const result = await cached('k', 0, async () => {
      throw new Error('429');
    });

    assert.equal(result.value, 'good');
    assert.equal(result.stale, true);
  });

  it('propagates the failure when there is nothing to fall back to', async () => {
    await assert.rejects(
      cached('cold', 60, async () => {
        throw new Error('upstream down');
      }),
      /upstream down/,
    );
  });

  it('does not cache a failure', async () => {
    let calls = 0;

    await assert.rejects(
      cached('k', 60, async () => {
        calls += 1;
        throw new Error('boom');
      }),
    );

    const result = await cached('k', 60, async () => {
      calls += 1;
      return 'recovered';
    });

    assert.equal(calls, 2);
    assert.equal(result.value, 'recovered');
  });

  it('gives a joined caller the stale value rather than the leader’s error', async () => {
    await cached('k', 0, async () => 'good');

    const fail = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error('429');
    };

    const [a, b] = await Promise.all([cached('k', 0, fail), cached('k', 0, fail)]);

    assert.equal(a.value, 'good');
    assert.equal(b.value, 'good');
    assert.ok(a.stale && b.stale);
  });

  it('tracks entries for the health check', async () => {
    await cached('a', 60, async () => 1);
    await cached('b', 60, async () => 2);

    assert.equal(cacheSize(), 2);
  });

  describe('dropCache', () => {
    it('drops everything and reports the count', async () => {
      await cached('a', 60, async () => 1);
      await cached('b', 60, async () => 2);

      assert.equal(dropCache(), 2);
      assert.equal(cacheSize(), 0);
    });

    it('drops only the keys under a prefix', async () => {
      await cached('detail:x', 60, async () => 1);
      await cached('detail:y', 60, async () => 2);
      await cached('audit:x', 60, async () => 3);

      assert.equal(dropCache('detail:'), 2);
      assert.equal(cacheSize(), 1);
      assert.deepEqual(
        cacheEntries().map((e) => e.key),
        ['audit:x'],
      );
    });

    it('reports nothing dropped when the prefix matches no key', async () => {
      await cached('audit:x', 60, async () => 1);

      assert.equal(dropCache('detail:'), 0);
      assert.equal(cacheSize(), 1);
    });

    it('does not let a load that started before the flush repopulate it', async () => {
      let release: (value: string) => void = () => {};
      const pending = new Promise<string>((resolve) => {
        release = resolve;
      });

      const inFlight = cached('slow', 60, () => pending);

      dropCache();
      release('stale-read');

      await inFlight;

      assert.equal(cacheSize(), 0);
    });

    it('still answers the caller that was already waiting on that load', async () => {
      const inFlight = cached('slow', 60, async () => 'value');

      dropCache();

      assert.equal((await inFlight).value, 'value');
    });
  });

  describe('cacheEntries', () => {
    it('reports a fresh entry as fresh, with time left on it', async () => {
      await cached('a', 60, async () => 1);

      const [entry] = cacheEntries();

      assert.equal(entry.key, 'a');
      assert.equal(entry.fresh, true);
      assert.ok(entry.freshForSeconds > 0 && entry.freshForSeconds <= 60);
      assert.ok(entry.staleForSeconds > 60);
    });

    it('reports a past-TTL entry as not fresh but still held', async () => {
      await cached('a', 0, async () => 1);

      const [entry] = cacheEntries();

      assert.equal(entry.fresh, false);
      assert.equal(entry.freshForSeconds, 0);
      // Still servable as a fallback.
      assert.ok(entry.staleForSeconds > 0);
    });

    it('narrows to a prefix', async () => {
      await cached('detail:x', 60, async () => 1);
      await cached('audit:x', 60, async () => 2);

      assert.deepEqual(
        cacheEntries('detail:').map((e) => e.key),
        ['detail:x'],
      );
    });
  });
});
