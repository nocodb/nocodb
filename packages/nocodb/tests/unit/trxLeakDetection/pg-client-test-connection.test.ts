import { expect } from 'chai';
import 'mocha';
import PgClient from '~/db/sql-client/lib/pg/PgClient';
import { diff, installLeakTracker, snapshot } from '../utils/leakTracker';

/**
 * Direct regression test for PR #8883 Symptom B in `PgClient.testConnection`.
 *
 * The buggy shape was: `tempSqlClient = knex(...)` inside the outer catch,
 * then `tempSqlClient.raw(...)` inside an inner try, and `destroy()` only
 * on the success branch of the inner try. When the inner raw rejected
 * (which is exactly when the failure path is interesting), destroy()
 * never ran and the tarn pool was orphaned.
 *
 * Fix (`4164d34b2a`): move `tempSqlClient.destroy()` into a `finally` block
 * inside the outer catch.
 *
 * This test exercises the actual production `PgClient.testConnection`
 * with a connection config guaranteed to fail (loopback + closed port).
 * The outer `this.raw('SELECT 1+1')` fails -> enters catch -> inner raw
 * also fails -> finally must destroy `tempSqlClient`. We assert that the
 * delta in pool count across the call is exactly zero.
 *
 * A regression that moves `destroy()` back onto the success branch (or
 * removes the finally) will leave one orphan pool and fail this test.
 */
function pgClientTestConnectionTests() {
  before(installLeakTracker);

  describe('PgClient.testConnection error path does not orphan a pool', () => {
    it('cleans up the temp pool when both outer and inner raw reject', async function () {
      // pg driver with a config that cannot connect. Port 1 is reserved
      // and ECONNREFUSED is returned by the kernel without any network
      // round-trip when the port is closed on loopback. We still set a
      // short connectionTimeoutMillis as a safety net in case the env
      // routes 127.0.0.1:1 somewhere weird.
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

      // The outer pool is created by the KnexClient base constructor.
      // Snapshot AFTER construction so the assertion isolates only pools
      // opened by `testConnection` itself.
      const client: any = new PgClient(badConfig as any);

      try {
        const before = snapshot();

        const result = await client.testConnection({});

        const report = diff(before);
        expect(
          report.pools.length,
          'testConnection error path must not orphan any pool',
        ).to.equal(0);

        // Sanity: the call should have set result.code = -1 because the
        // inner raw failed with a connection error (not a "database does
        // not exist" error). If this changes, the test no longer covers
        // the fix path it was written for.
        expect(
          result?.code,
          'testConnection should report -1 on a true connection failure',
        ).to.equal(-1);
      } finally {
        await client.sqlClient.destroy();
      }
    });
  });
}

export { pgClientTestConnectionTests };
