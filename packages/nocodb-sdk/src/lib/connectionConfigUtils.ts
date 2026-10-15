import { SSLUsage } from '~/lib/enums';

/**
 * SSL fields a DB connection form can supply, for the knex `pg` / `mysql2`
 * drivers. The integration auth forms write `sslMode` (+ a pasted `sslCa`);
 * the built-in Database data-source form additionally supports client
 * certificates for mutual TLS.
 */
export interface SqlSslConfig {
  /** SSL mode chosen in the form (an `SSLUsage` value). */
  sslMode?: SSLUsage | string;
  /** PEM contents of a CA certificate used to verify the server. */
  sslCa?: string;
  /** PEM client certificate / key — mutual TLS. */
  sslCert?: string;
  sslKey?: string;
  /**
   * Legacy on/off flag kept for configs created before `sslMode` existed.
   * @deprecated use `sslMode`.
   */
  ssl?: string | boolean;
}

/** The value assigned to knex `connection.ssl` for the `pg` / `mysql2` drivers. */
// Always an object when TLS is on, never boolean `true`: mysql2 throws on a
// boolean ("SSL profile must be an object") before it opens a socket.
export type KnexSqlSslValue =
  | {
      ca?: string;
      cert?: string;
      key?: string;
      rejectUnauthorized: boolean;
    }
  | undefined;

/**
 * Resolve the knex `connection.ssl` value for an SSL mode:
 *
 * - `No` / unset             → no TLS (plain connection)
 * - `Allowed` / `Preferred`  → TLS **without** verifying the server certificate
 *                              (`rejectUnauthorized: false`) — lets servers with
 *                              self-signed / private certs connect, matching
 *                              libpq's `allow`/`prefer` modes
 * - `Required` (no CA)       → TLS, verified against the system/public CA bundle
 *                              — what managed providers such as Neon, Supabase,
 *                              Amazon RDS and Azure require
 * - `Required-CA` + CA PEM   → TLS, verified against the supplied CA (self-signed
 *                              / private-CA servers)
 *
 * A pasted CA always implies verification regardless of the exact mode, so a
 * private-CA server works without a separate toggle. Client certificates ride
 * along with whatever the mode resolves to — they authenticate the CLIENT and
 * never decide whether the server is verified.
 *
 * Every mode maps to a distinct shape, so `sslModeFromConfig` can recover the
 * mode from a stored config and nothing extra has to be persisted.
 */
export function buildSqlAuthSsl(config: SqlSslConfig): KnexSqlSslValue {
  const pem = (v?: string) =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined;

  const ca = pem(config.sslCa);
  const cert = pem(config.sslCert);
  const key = pem(config.sslKey);
  const mode = config.sslMode;

  const withClientCerts = (ssl: KnexSqlSslValue & object) => {
    if (cert) ssl.cert = cert;
    if (key) ssl.key = key;
    return ssl;
  };

  // A pasted CA certificate always implies verifying the server against it.
  if (ca) return withClientCerts({ ca, rejectUnauthorized: true });

  if (!mode || mode === SSLUsage.No) {
    // Back-compat: honour the pre-`sslMode` boolean flag if it was ever set.
    // Object form for the same reason as below — a legacy config carrying
    // `ssl: true` hit the identical mysql2 crash.
    if (config.ssl === true || config.ssl === 'true')
      return withClientCerts({ rejectUnauthorized: true });
    return undefined;
  }

  // Encrypt but don't verify the certificate — the only way a server with a
  // self-signed / mismatched cert can connect.
  if (mode === SSLUsage.Allowed || mode === SSLUsage.Preferred) {
    return withClientCerts({ rejectUnauthorized: false });
  }

  // Any other non-`No` mode without a custom CA → TLS verified against the
  // public CAs. Must be the object form, not boolean `true`: mysql2 rejects a
  // boolean outright ("SSL profile must be an object, instead it's a boolean")
  // before it ever opens a socket, which made `Required` unusable on MySQL.
  // pg treats `{rejectUnauthorized:true}` and `true` identically — it spreads
  // any non-`true` ssl value straight into `tls.connect`.
  return withClientCerts({ rejectUnauthorized: true });
}

/**
 * Inverse of `buildSqlAuthSsl`: recover the SSL mode a stored
 * `connection.ssl` represents, so a form can round-trip the dropdown without
 * the mode being persisted alongside it.
 *
 * Legacy shapes map to the mode they ALREADY behave as, so reading an existing
 * config never changes its meaning:
 *   - `true` / `'true'`          — pg spread these into bare `tls.connect`
 *                                  defaults, i.e. verified → `Required`
 *   - `{ca:'',cert:'',key:''}`   — Node ignores empty-string certs and falls
 *                                  back to the public CAs → `Required`
 *
 * `Required-Identity` is never produced: verify-ca and verify-full differ only
 * by `checkServerIdentity`, a function, which a stored JSON config cannot hold.
 */
export function sslModeFromConfig(ssl: unknown): SSLUsage {
  if (!ssl) return SSLUsage.No;

  if (typeof ssl !== 'object') {
    return ssl === true || ssl === 'true' ? SSLUsage.Required : SSLUsage.No;
  }

  const config = ssl as Record<string, unknown>;

  if (config.rejectUnauthorized === false) return SSLUsage.Preferred;

  if (typeof config.ca === 'string' && config.ca.trim())
    return SSLUsage.RequiredWithCa;

  return SSLUsage.Required;
}

/**
 * Normalise whatever a form posted into the canonical `connection.ssl` shape.
 *
 * Never returns a boolean or a string: mysql2 rejects both before opening a
 * socket, and the explicit `rejectUnauthorized` is what lets the mode be
 * recovered later by `sslModeFromConfig`.
 */
export const validateAndExtractSSLProp = (
  connectionConfig: any,
  sslUse?: SSLUsage,
  _client?: string
): KnexSqlSslValue => {
  // An explicit "off" wins over a stale ssl blob left behind in form state.
  if (sslUse === SSLUsage.No) return undefined;

  const ssl = connectionConfig?.ssl;
  if (!ssl) return undefined;

  if (typeof ssl !== 'object') {
    return ssl === true || ssl === 'true'
      ? { rejectUnauthorized: true }
      : undefined;
  }

  return buildSqlAuthSsl({
    sslMode: sslModeFromConfig(ssl),
    sslCa: ssl.ca,
    sslCert: ssl.cert,
    sslKey: ssl.key,
  });
};

/** Credential fields of a DB connection config. Read by masking, the vault write guard and the form. */
export interface DbCredentialField {
  path: readonly string[];
  /** May hold a `$vault` reference instead of the value. */
  vault: boolean;
  /** Blanked before a config is returned to a client. */
  mask: boolean;
}

export const DB_CREDENTIAL_FIELDS: readonly DbCredentialField[] = [
  { path: ['connection', 'user'], vault: true, mask: false },
  { path: ['connection', 'password'], vault: true, mask: true },
  // A reference would stand in for the whole DSN, host included.
  { path: ['connection', 'connectionString'], vault: false, mask: true },
  { path: ['connection', 'connectionUri'], vault: false, mask: true },
  { path: ['connection', 'uri'], vault: false, mask: true },
  { path: ['connection', 'url'], vault: false, mask: true },
  { path: ['connection', 'ssl', 'key'], vault: true, mask: true },
  { path: ['connection', 'ssl', 'cert'], vault: true, mask: true },
  { path: ['connection', 'ssl', 'ca'], vault: true, mask: true },
  { path: ['connection', 'ssl', 'pfx'], vault: false, mask: true },
  { path: ['connection', 'ssl', 'passphrase'], vault: false, mask: true },
];

const samePath = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((segment, i) => segment === b[i]);

export const isVaultReferenceablePath = (path: readonly string[]): boolean =>
  DB_CREDENTIAL_FIELDS.some(
    (field) => field.vault && samePath(field.path, path)
  );
