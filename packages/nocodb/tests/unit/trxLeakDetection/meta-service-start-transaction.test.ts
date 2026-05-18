import { expect } from 'chai';
import 'mocha';
import { MetaService } from '~/meta/meta.service';
import { diff, installLeakTracker, snapshot } from '../utils/leakTracker';

/**
 * Direct regression test for the root cause of PR #8883 Symptom B:
 * `MetaService.startTransaction()` used to construct a fresh `MetaService`
 * without passing the parent's knex through. That fresh instance built a
 * brand-new pg pool (`min` connections held forever), and nobody held a
 * reference to destroy it. Fix: `7e8c118b15` — pass `this._knex` through
 * the constructor so the wrapper reuses the parent's pool.
 *
 * The structural test in `transaction-no-new-pool.test.ts` only proves
 * that raw `knex.transaction()` doesn't create a pool — which is a Knex
 * library guarantee and would still pass even if MetaService regressed.
 * This test exercises the actual production wrapper, so a regression
 * (e.g. someone removing the `sharedKnex` argument) fails CI directly.
 */
function metaServiceStartTransactionTests() {
  before(installLeakTracker);

  describe('MetaService.startTransaction does not allocate a new pool', () => {
    it('reuses the parent knex pool when opening a wrapper trx', async () => {
      // Minimal NcConfig stub — MetaService only reads `config.meta.db`.
      const fakeConfig: any = {
        meta: {
          db: {
            client: 'sqlite3',
            connection: { filename: ':memory:' },
            useNullAsDefault: true,
          },
        },
      };

      const meta = new MetaService(fakeConfig);

      try {
        const before = snapshot();

        const trxMeta = await meta.startTransaction();
        try {
          const report = diff(before);
          expect(
            report.pools.length,
            'startTransaction must NOT allocate a new pool',
          ).to.equal(0);
          expect(
            report.trxs.length,
            'startTransaction should open exactly one trx',
          ).to.equal(1);
        } finally {
          await trxMeta.rollback();
        }

        // After rollback, the trx is deregistered and we are back to baseline.
        const afterReport = diff(before);
        expect(
          afterReport.trxs.length,
          'trx must be deregistered after rollback',
        ).to.equal(0);
        expect(
          afterReport.pools.length,
          'no pool delta after the wrapper trx is closed',
        ).to.equal(0);
      } finally {
        await meta.knexInstance.destroy();
      }
    });

    it('nested startTransaction still does not allocate a new pool', async () => {
      const fakeConfig: any = {
        meta: {
          db: {
            client: 'sqlite3',
            connection: { filename: ':memory:' },
            useNullAsDefault: true,
          },
        },
      };

      const meta = new MetaService(fakeConfig);

      try {
        const before = snapshot();

        const outer = await meta.startTransaction();
        try {
          const inner = await outer.startTransaction();
          try {
            const report = diff(before);
            expect(
              report.pools.length,
              'nested startTransaction must not allocate pools',
            ).to.equal(0);
          } finally {
            await inner.rollback();
          }
        } finally {
          await outer.rollback();
        }
      } finally {
        await meta.knexInstance.destroy();
      }
    });
  });
}

export { metaServiceStartTransactionTests };
