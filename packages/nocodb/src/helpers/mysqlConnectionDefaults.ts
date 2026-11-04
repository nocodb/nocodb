import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';

const logger = new Logger('MysqlConnectionDefaults');

// GROUP_CONCAT truncates silently at 1024 bytes by default (lookups, rollups)
export const MYSQL_SESSION_DEFAULTS_SQL =
  'SET SESSION group_concat_max_len = 4294967295';

/**
 * The typeCast external MySQL sources and the sql-executor already use: BIT as
 * a number, other buffers as hex, DECIMAL (SUM, AVG, decimal fields) as a
 * number rather than a string. Kept if the config sets its own.
 *
 * `decimalsOnly` is for the meta DB, which also serves CE's default data
 * source: meta binary columns (e.g. Yjs state) must stay buffers.
 * DECIMAL parses through a double, as on external sources: digits past ~15
 * significant ones round.
 */
export function applyMysqlTypeCast(
  knexConfig: Knex.Config | undefined,
  { decimalsOnly = false }: { decimalsOnly?: boolean } = {},
): void {
  if (knexConfig?.client !== 'mysql2' && knexConfig?.client !== 'mysql') return;
  const connection = knexConfig.connection;
  if (!connection || typeof connection !== 'object') return;
  if ('typeCast' in connection && connection.typeCast) return;
  // a copy: the connection object may be shared with other configs
  knexConfig.connection = {
    ...connection,
    typeCast(field: { type: string }, next: () => unknown): unknown {
      const res = next();
      if (res instanceof Buffer && !decimalsOnly) {
        const hex = [...res].map((v) => ('00' + v.toString(16)).slice(-2));
        return field.type === 'BIT' ? parseInt(hex.join(''), 16) : hex.join('');
      }
      if (field.type === 'NEWDECIMAL') {
        return typeof res === 'string' ? parseFloat(res) : res;
      }
      return res;
    },
  } as Knex.Config['connection'];
}

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
