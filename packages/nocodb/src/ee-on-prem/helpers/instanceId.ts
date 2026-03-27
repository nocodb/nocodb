import crypto from 'crypto';
import Noco from '~/Noco';

/**
 * Get a stable instance ID for this NocoDB instance.
 *
 * Only PostgreSQL is supported for on-prem licensing. The ID is derived
 * from two stable values:
 *   - system_identifier: unique per PG cluster, set at initdb time
 *   - current_database(): the specific database name within that cluster
 *
 * This ensures that multiple NocoDB instances on the same PG server
 * (different databases) get distinct instance IDs.
 *
 * The combined hash survives container restarts, K8s rescheduling,
 * and ECS task cycling. Only changes on pg_dump/restore to a new
 * cluster or if the database is renamed.
 */
export async function getInstanceId(ncMeta = Noco.ncMeta): Promise<string> {
  try {
    const result = await ncMeta.knexConnection.raw(
      'SELECT system_identifier, current_database() AS db_name FROM pg_control_system()',
    );
    const row = result.rows?.[0];
    if (row?.system_identifier && row?.db_name) {
      return crypto
        .createHash('sha256')
        .update(`pg:${row.system_identifier}:${row.db_name}`)
        .digest('hex');
    }
  } catch {
    // Not PostgreSQL
  }

  throw new Error(
    'License activation requires PostgreSQL. SQLite and MySQL are not supported for on-premise licensing.',
  );
}
