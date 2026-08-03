import { SSLUsage } from 'nocodb-sdk';

// Re-exported so the DB auth integrations can build their SSL-mode dropdowns
// from the same enum the built-in "Database" data-source form uses, keeping
// one shared vocabulary across the app.
export { SSLUsage };

/**
 * SSL-related config fields shared by the SQL DB auth integrations that connect
 * through knex's `pg` / `mysql2` drivers (postgres, mysql). The form writes
 * `sslMode` (and, for the verify-CA mode, a pasted `sslCa` PEM).
 */
export interface SqlAuthSslConfig {
  /** SSL mode chosen in the form (an `SSLUsage` value). */
  sslMode?: SSLUsage | string;
  /** PEM contents of a CA certificate used to verify the server. */
  sslCa?: string;
  /**
   * Legacy on/off flag kept for integrations created before `sslMode` existed.
   * @deprecated use `sslMode`.
   */
  ssl?: string | boolean;
}

/** The value assigned to knex `connection.ssl` for the `pg` / `mysql2` drivers. */
export type KnexSqlSslValue =
  | true
  | { ca: string; rejectUnauthorized: true }
  | undefined;

/**
 * Resolve the knex `connection.ssl` value for a SQL auth integration, mirroring
 * the built-in "Database" data-source form's behaviour:
 *
 * - `No` / unset            → no TLS (plain connection)
 * - `Required` (no CA)      → TLS, verified against the system/public CA bundle
 *                             — what managed providers such as Neon, Supabase,
 *                             Amazon RDS and Azure require
 * - `Required-CA` + CA PEM  → TLS, verified against the supplied CA (self-signed
 *                             / private-CA servers)
 *
 * A pasted CA always implies verification regardless of the exact mode, so a
 * private-CA server works without a separate toggle. Client certificates
 * (mutual TLS) are intentionally not handled here yet.
 */
export function buildSqlAuthSsl(config: SqlAuthSslConfig): KnexSqlSslValue {
  const ca = typeof config.sslCa === 'string' ? config.sslCa.trim() : '';

  // A CA certificate was supplied — verify the server against it.
  if (ca) return { ca, rejectUnauthorized: true };

  const mode = config.sslMode;

  if (!mode || mode === SSLUsage.No) {
    // Back-compat: honour the pre-`sslMode` boolean flag if it was ever set.
    if (config.ssl === true || config.ssl === 'true') return true;
    return undefined;
  }

  // Any non-`No` mode without a custom CA → TLS verified against the public CAs.
  return true;
}
