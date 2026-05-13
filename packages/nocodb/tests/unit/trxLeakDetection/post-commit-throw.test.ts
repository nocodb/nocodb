import { expect } from 'chai';
import 'mocha';
import { knex } from 'knex';
import { diff, installLeakTracker, snapshot } from '../utils/leakTracker';

/**
 * Postmortem pattern (Symptom A, post-commit variant): code that runs
 * AFTER `commit()` but still inside the outer `try {}` block. If that
 * post-commit code throws, the catch attempts `rollback()` on an
 * already-completed trx — secondary "Transaction is already complete"
 * masks the original error. Fix pattern: clear `trx = null` immediately
 * after `commit()` and null-check before rollback.
 *
 * This isn't a connection leak per se (commit released the connection),
 * but it's the same bug class as it lives in the trx surface area, and
 * the fix pattern must hold on every transactional path.
 */
function postCommitThrowTests() {
  before(installLeakTracker);

  describe('post-commit-throw fix pattern', () => {
    it('trx-null-after-commit prevents secondary rollback error', async () => {
      const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });

      let trx: any = await db.transaction();
      let originalError: Error | null = null;
      let secondaryError: Error | null = null;

      try {
        await trx.commit();
        trx = null; // ← fix pattern from `d2e21749d0`
        throw new Error('post-commit work failed');
      } catch (e) {
        originalError = e as Error;
        if (trx) {
          try {
            await trx.rollback();
          } catch (rb) {
            secondaryError = rb as Error;
          }
        }
      }

      expect(originalError?.message).to.equal('post-commit work failed');
      expect(secondaryError, 'rollback must not be called on a completed trx')
        .to.be.null;

      await db.destroy();
    });

    it('does not leak the trx after commit, regardless of post-commit throw', async () => {
      const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });

      const before = snapshot();

      let trx: any = await db.transaction();
      try {
        await trx.commit();
        trx = null;
        throw new Error('post-commit work failed');
      } catch {
        if (trx) await trx.rollback();
      }

      const report = diff(before);
      expect(report.trxs.length, 'committed trx must not appear as leaked').to.equal(0);

      await db.destroy();
    });
  });
}

export { postCommitThrowTests };
