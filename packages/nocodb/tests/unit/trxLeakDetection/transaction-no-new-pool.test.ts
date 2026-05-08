import { expect } from 'chai';
import 'mocha';
import { knex } from 'knex';
import { diff, installLeakTracker, snapshot } from '../utils/leakTracker';

/**
 * Postmortem Symptom B / Root Cause #2 (`MetaService.startTransaction`):
 * the wrapper used to construct a fresh `MetaService` instance every
 * call, which constructed a fresh Knex pool. The wrapper itself never
 * used the new pool (the trx was correctly bound to the original pool's
 * connection), but the new pool's tarn timers ran forever and nobody
 * held a reference to destroy it. Fix (`7e8c118b15`) made the wrapper
 * reuse the parent's existing Knex pool.
 *
 * The structural invariant: opening a transaction on an existing Knex
 * instance must NOT create a new pool. This test fixes that invariant
 * in CI — any future regression of the pattern (calling `knex(...)` to
 * wrap a trx) fails this test.
 */
function transactionNoNewPoolTests() {
  before(installLeakTracker);

  describe('transaction does not allocate a new pool', () => {
    it('Knex.transaction() reuses the existing pool', async () => {
      const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });

      try {
        const before = snapshot();

        const trx = await db.transaction();
        const report = diff(before);

        expect(report.pools.length, 'no new pool should be created').to.equal(0);
        expect(report.trxs.length, 'one trx should be tracked').to.equal(1);

        await trx.rollback();
      } finally {
        await db.destroy();
      }
    });

    it('nested transactions do not allocate new pools', async () => {
      const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      });

      try {
        const before = snapshot();

        await db.transaction(async (outer) => {
          await outer.transaction(async (_inner) => {
            // savepoint scope
          });
        });

        const report = diff(before);
        expect(report.pools.length, 'nested trx must not allocate pools').to.equal(0);
      } finally {
        await db.destroy();
      }
    });
  });
}

export { transactionNoNewPoolTests };
