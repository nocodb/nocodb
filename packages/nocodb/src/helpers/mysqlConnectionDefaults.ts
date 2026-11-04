import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';

const logger = new Logger('MysqlConnectionDefaults');

// GROUP_CONCAT truncates silently at 1024 bytes by default (lookups, rollups)
export const MYSQL_SESSION_DEFAULTS_SQL =
  'SET SESSION group_concat_max_len = 4294967295';

// the callback-style connection mysql / mysql2 hand to pool.afterCreate
export interface MysqlCallbackConnection {
  query(sql: string, callback: (err: Error | null) => void): unknown;
}

/**
 * Session defaults for MySQL pools, applied to the knex config right before
 * instantiation. No-op for other clients. Non-fatal: servers that reject the
 * SET (Vitess, PlanetScale, TiDB …) keep the connection.
 */
export function applyMysqlConnectionDefaults(
  knexConfig: Pick<Knex.Config, 'client' | 'pool'>,
): void {
  if (knexConfig?.client !== 'mysql2' && knexConfig?.client !== 'mysql') return;

  const prevAfterCreate = knexConfig.pool?.afterCreate;
  knexConfig.pool = {
    ...knexConfig.pool,
    afterCreate(
      conn: MysqlCallbackConnection,
      done: (err: Error | null, conn: MysqlCallbackConnection) => void,
    ) {
      conn.query(MYSQL_SESSION_DEFAULTS_SQL, (err) => {
        if (err) {
          logger.warn(
            `Could not raise group_concat_max_len, joined text may truncate at 1024 bytes: ${err.message}`,
          );
        }
        if (prevAfterCreate) return prevAfterCreate(conn, done);
        done(null, conn);
      });
    },
  };
}
