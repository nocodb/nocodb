import { expect } from 'chai';
import 'mocha';
import { knex } from 'knex';
import { diff, installLeakTracker, snapshot } from '../utils/leakTracker';

/**
 * Postmortem Symptom B: a `knex({...})` instance is constructed for an
 * admin operation (e.g. `PgClient.testConnection`, `PgClient.dropDatabase`)
 * but `.destroy()` is only called on the success path. On error, the
 * pool is orphaned — its tarn timers keep running, and nothing has a
 * reference to destroy it. Fix (`4164d34b2a`) moved `destroy()` into a
 * `finally` block.
 *
 * Tracker must flag the orphaned pool so any future regression of this
 * pattern fails CI.
 */
function orphanPoolOnErrorTests() {
  before(installLeakTracker);

  describe('orphan-pool-on-error leak detection', () => {
    it('reports a leaked pool when knex() is created and an error skips destroy()', async () => {
      const before = snapshot();

      const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });

      try {
        // Force the orphan-pool shape: throw before db.destroy() is reached.
        throw new Error('admin operation failed');
      } catch {
        /* Buggy shape: no `finally { db.destroy() }`. */
      }

      const report = diff(before);
      expect(report.pools.length, 'tracker should report 1 leaked pool').to.equal(1);
      expect(report.pools[0].meta?.client).to.equal('sqlite3');

      // Cleanup so the test itself doesn't actually leak.
      await db.destroy();
    });

    it('does not leak when destroy() is in a finally block', async () => {
      const before = snapshot();

      const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });

      try {
        try {
          throw new Error('admin operation failed');
        } finally {
          await db.destroy();
        }
      } catch {
        /* swallow for assertion */
      }

      const report = diff(before);
      expect(report.pools.length, 'fixed shape must not leak').to.equal(0);
    });
  });
}

export { orphanPoolOnErrorTests };
