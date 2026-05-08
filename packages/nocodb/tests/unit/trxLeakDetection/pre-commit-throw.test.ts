import { expect } from 'chai';
import 'mocha';
import { knex } from 'knex';
import {
  diff,
  installLeakTracker,
  snapshot,
} from '../utils/leakTracker';

/**
 * Postmortem pattern (Symptom A, pre-commit variant): async work that
 * throws between `transaction()` and the enclosing `try {}` leaves the
 * trx neither committed nor rolled back. Five sites had this shape
 * before PR #8880 (`d2e21749d0`).
 *
 * The tracker must report this as a leak. Without the tracker, the
 * symptom only surfaces as `idle in transaction` rows in
 * pg_stat_activity under load.
 */
function preCommitThrowTests() {
  before(installLeakTracker);

  describe('pre-commit-throw leak detection', () => {
    it('reports a leaked transaction when async work throws before commit/rollback', async () => {
      const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });

      const before = snapshot();

      const trx = await db.transaction();
      try {
        await Promise.reject(new Error('async work failed'));
      } catch (_e) {
        // Buggy shape: catch block does not run rollback because the throw
        // happened OUTSIDE the try { } that wraps commit/rollback. Below we
        // simulate that by deliberately not calling rollback here.
      }

      const report = diff(before);
      expect(report.trxs.length, 'tracker should report 1 leaked trx').to.equal(1);

      // Cleanup so the test itself doesn't actually leak.
      await trx.rollback();
      await db.destroy();
    });

    it('does not report a leak when the same code is written safely', async () => {
      const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });

      const before = snapshot();

      // Fixed shape: pre-trx async work happens BEFORE transaction() opens.
      try {
        await Promise.resolve();
      } catch {
        /* no-op */
      }
      const trx = await db.transaction();
      try {
        throw new Error('post-trx work failed');
      } catch (_e) {
        await trx.rollback();
      }

      const report = diff(before);
      expect(report.trxs.length, 'fixed shape must not leak').to.equal(0);

      await db.destroy();
    });
  });
}

export { preCommitThrowTests };
