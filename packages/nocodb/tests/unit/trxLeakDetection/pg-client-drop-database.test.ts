import { expect } from 'chai';
import 'mocha';
import PgClient from '../../../src/db/sql-client/lib/pg/PgClient';
import { diff, installLeakTracker, snapshot } from '../utils/leakTracker';

/**
 * Direct regression test for PR #8883 Symptom B in `PgClient.dropDatabase`.
 *
 * The buggy shape was: open `tempSqlClient`, destroy the outer
 * `this.sqlClient`, then run admin SQL via `tempSqlClient`. If the admin
 * SQL threw (e.g. permission error, target db does not exist), the catch
 * swallowed the error but `tempSqlClient.destroy()` was on the success
 * branch only -> orphan pool.
 *
 * Fix (`4164d34b2a`): wrap `tempSqlClient.destroy()` in a `finally` and
 * null-check `tempSqlClient` (because `knex(...)` itself can throw before
 * the variable is assigned).
 *
 * This test runs `dropDatabase` against an unreachable pg config so that:
 *   1. `this.sqlClient.destroy()` succeeds (it's just tearing down a pool
 *      that never connected),
 *   2. `tempSqlClient` is constructed,
 *   3. `tempSqlClient.raw('ALTER DATABASE ...')` rejects with a connection
 *      error,
 *   4. The catch swallows it,
 *   5. The finally MUST destroy `tempSqlClient`.
 *
 * We assert that no new pool is open at the end of the call. Regression
 * (removing the finally, or putting destroy() back on the success branch)
 * leaves one orphan and fails the test.
 */
function pgClientDropDatabaseTests() {
  before(installLeakTracker);

  describe('PgClient.dropDatabase error path does not orphan a pool', () => {
    it('cleans up the temp pool when the admin SQL rejects', async function () {
      const badConfig = {
        client: 'pg',
        connection: {
          host: '127.0.0.1',
          port: 1,
          user: 'noco_leak_test',
          password: 'noco_leak_test',
          database: 'noco_leak_test',
          connectionTimeoutMillis: 500,
        },
        pool: { min: 0, max: 1, acquireTimeoutMillis: 1500 },
      };

      const client: any = new PgClient(badConfig as any);

      // Snapshot AFTER construction so we only count pools opened by
      // dropDatabase itself. Note: dropDatabase destroys `this.sqlClient`
      // mid-flight, but the outer pool exists in the snapshot so its
      // destruction does not register as a leak either way — we are
      // strictly asserting that no NEW pool remains open.
      const before = snapshot();

      try {
        await client.dropDatabase({ database: 'noco_leak_test_target' });
      } finally {
        // dropDatabase reassigns `this.sqlClient = tempSqlClient` then
        // destroys it in its own finally. `destroy()` is idempotent on
        // an already-destroyed Knex instance, so we can safely call it
        // again as belt-and-braces cleanup.
        try {
          await client.sqlClient?.destroy();
        } catch {
          /* best-effort cleanup */
        }
      }

      const report = diff(before);
      expect(
        report.pools.length,
        'dropDatabase error path must not orphan any pool',
      ).to.equal(0);
    });
  });
}

export { pgClientDropDatabaseTests };
