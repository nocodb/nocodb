import { ClientType } from '~/lib/enums';
import { IntegrationsType } from '~/lib/Api';
import {
  buildSqlAuthSsl,
  sslModeFromConfig,
} from '~/lib/connectionConfigUtils';
import type { SqlSslConfig } from '~/lib/connectionConfigUtils';

/**
 * Meta key marking an auth (app connection) integration that is ALSO usable as
 * a base data source. Set on create only, so rows created before it existed
 * keep their single use.
 */
export const DATA_SOURCE_INTEGRATION_META_KEY = 'dataSource';

/** Auth sub_type → the knex client the data layer connects with. */
const DATA_SOURCE_AUTH_CLIENTS: Readonly<Record<string, ClientType>> = {
  postgres: ClientType.PG,
  mysql: ClientType.MYSQL,
  mssql: ClientType.MSSQL,
};

const DEFAULT_PORTS: Readonly<Partial<Record<string, number>>> = {
  [ClientType.PG]: 5432,
  [ClientType.MYSQL]: 3306,
  [ClientType.MSSQL]: 1433,
};

/** Clients whose knex `searchPath` selects the schema. */
const SCHEMA_CLIENTS: readonly string[] = [ClientType.PG, ClientType.MSSQL];

/**
 * Connection keys an extra parameter may not set: they pick the server or
 * carry credentials, which only the form's own fields (and their SSRF and
 * secret handling) may do.
 */
const RESERVED_CONNECTION_KEYS = new Set([
  'host',
  'server',
  'port',
  'user',
  'username',
  'password',
  'database',
  'ssl',
  'options',
  'connectionString',
  'socketPath',
  'uri',
  'url',
  'stream',
  'filename',
  'domain',
  'authentication',
  'instanceName',
  'lookup',
  // knex's mssql dialect builds tedious `authentication` from these.
  'type',
  'userName',
  'token',
  'clientId',
  'clientSecret',
  'tenantId',
  'msiEndpoint',
]);

interface IntegrationLike {
  type?: string | null;
  sub_type?: string | null;
  meta?: unknown;
}

const metaOf = (meta: unknown): Record<string, unknown> | null => {
  if (meta && typeof meta === 'object') return meta as Record<string, unknown>;
  if (typeof meta === 'string' && meta) {
    try {
      const parsed = JSON.parse(meta);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

/** Whether a NEW integration of this kind is created as a combined one. */
export function supportsDataSourceUse(
  type?: string | null,
  subType?: string | null
): boolean {
  return (
    type === IntegrationsType.Auth &&
    !!subType &&
    subType in DATA_SOURCE_AUTH_CLIENTS
  );
}

/** An app connection that can also back a base data source. */
export function isCombinedDataSourceIntegration(
  integration?: IntegrationLike | null
): boolean {
  return (
    !!integration &&
    supportsDataSourceUse(integration.type, integration.sub_type) &&
    metaOf(integration.meta)?.[DATA_SOURCE_INTEGRATION_META_KEY] === true
  );
}

/** Any integration a base data source can be created from. */
export function isDataSourceIntegration(
  integration?: IntegrationLike | null
): boolean {
  return (
    !!integration &&
    (integration.type === IntegrationsType.Database ||
      isCombinedDataSourceIntegration(integration))
  );
}

/** The knex client (`Source.type`) a data source on this integration uses. */
export function dataSourceClientOf(
  integration?: IntegrationLike | null
): string | undefined {
  if (!integration?.sub_type) return undefined;
  if (isCombinedDataSourceIntegration(integration)) {
    return DATA_SOURCE_AUTH_CLIENTS[integration.sub_type];
  }
  return integration.sub_type;
}

/** The auth sub_type a NEW connection for this knex client is created as. */
export function combinedSubTypeForClient(
  client?: string | null
): string | undefined {
  return Object.keys(DATA_SOURCE_AUTH_CLIENTS).find(
    (subType) => DATA_SOURCE_AUTH_CLIENTS[subType] === client
  );
}

/** Whether a knex client can read a combined integration's flat config. */
export function isDataSourceAuthClient(client?: string | null): boolean {
  return (
    !!client && Object.values(DATA_SOURCE_AUTH_CLIENTS).includes(client as any)
  );
}

/** The flat config an SQL auth integration stores. */
export interface SqlAuthConnectionConfig extends SqlSslConfig {
  host?: string;
  port?: number | string;
  username?: string;
  password?: unknown;
  database?: string;
  /** Default schema (PG / MSSQL); a data source can still pick its own. */
  schema?: string;
  /** Extra driver connection parameters, `{ name: value }`. */
  extraParams?: Record<string, unknown> | null;
  /** MSSQL: encrypt the connection. Defaults to true. */
  encrypt?: string | boolean;
  /** MSSQL: trust a self-signed server certificate. Defaults to true. */
  trustServerCertificate?: string | boolean;
}

const toBool = (v: unknown, fallback: boolean): boolean => {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  return String(v).toLowerCase() === 'true';
};

/** The extra parameters that may go on the driver connection. */
export function sqlAuthExtraConnectionParams(
  config?: SqlAuthConnectionConfig | null
): Record<string, unknown> {
  const extra = config?.extraParams;
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return {};

  return Object.fromEntries(
    Object.entries(extra).filter(
      ([key]) => key.trim() && !RESERVED_CONNECTION_KEYS.has(key.trim())
    )
  );
}

/**
 * The knex config an SQL auth config connects with. Both uses build it here:
 * the app connection (the auth wrapper adds its pool) and the base data source,
 * so they dial the same server the same way.
 */
export function knexConfigFromSqlAuthConfig(
  client: string,
  config: SqlAuthConnectionConfig | null | undefined
): Record<string, any> {
  const cfg = config ?? {};
  const connection: Record<string, unknown> = {
    ...sqlAuthExtraConnectionParams(cfg),
    host: cfg.host,
    port: cfg.port || DEFAULT_PORTS[client] || undefined,
    user: cfg.username,
    password: cfg.password,
  };
  if (cfg.database) connection.database = cfg.database;

  if (client === ClientType.MSSQL) {
    // tedious rejects a string port.
    const port = Number(connection.port);
    connection.port = Number.isFinite(port) && port > 0 ? port : 1433;
    // tedious takes TLS settings under `options`, not a knex `ssl` object.
    const ca = typeof cfg.sslCa === 'string' ? cfg.sslCa.trim() : '';
    connection.options = {
      encrypt: toBool(cfg.encrypt, true),
      // A pasted CA means verify against it.
      trustServerCertificate: ca
        ? false
        : toBool(cfg.trustServerCertificate, true),
      ...(ca ? { cryptoCredentialsDetails: { ca } } : {}),
    };
  } else {
    const ssl = buildSqlAuthSsl(cfg);
    if (ssl !== undefined) connection.ssl = ssl;
  }

  const knexConfig: Record<string, any> = { client, connection };

  const schema = typeof cfg.schema === 'string' ? cfg.schema.trim() : '';
  if (schema && SCHEMA_CLIENTS.includes(client)) {
    knexConfig.searchPath = [schema];
  }

  return knexConfig;
}

/** SQL Server TLS fields a connection URL may set; an import keeps them otherwise. */
export const MSSQL_URL_TLS_FIELDS = [
  'encrypt',
  'trustServerCertificate',
] as const;

/** The TLS field a SQL Server URL key names: any case, optionally `options.`-prefixed. */
const mssqlUrlTlsField = (key: string) =>
  MSSQL_URL_TLS_FIELDS.find(
    (field) =>
      field.toLowerCase() === key.toLowerCase().replace(/^options\./, '')
  );

/** tedious's TDS 8 mode: not supported yet, so it connects with plain encryption. */
const isStrictEncrypt = (value: unknown) =>
  typeof value === 'string' && value.trim().toLowerCase() === 'strict';

/**
 * Whether an imported SQL Server URL asked for `encrypt=strict`, which the
 * connection doesn't support yet (it stays visible in the extra parameters).
 */
export function isMssqlStrictEncrypt(
  config?: Pick<SqlAuthConnectionConfig, 'extraParams'> | null
): boolean {
  return Object.entries(config?.extraParams ?? {}).some(
    ([key, value]) =>
      mssqlUrlTlsField(key) === 'encrypt' && isStrictEncrypt(value)
  );
}

const URL_BOOLEANS: Readonly<Record<string, boolean>> = {
  true: true,
  yes: true,
  '1': true,
  false: false,
  no: false,
  '0': false,
};

const urlBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  return URL_BOOLEANS[String(value).trim().toLowerCase()];
};

/**
 * `encrypt` / `trustServerCertificate` from a parsed SQL Server URL: a query
 * param in any case, optionally `options.`-prefixed, or a key of an `options`
 * object (or its JSON). Returns the readable values and the connection keys
 * they came from. An unreadable value is not consumed: it stays visible in the
 * extra parameters and sets nothing. `encrypt=strict` also stays there, and
 * connects with plain encryption until strict is supported.
 */
function mssqlTlsFromUrl(conn: Record<string, any>): {
  values: Partial<Record<(typeof MSSQL_URL_TLS_FIELDS)[number], boolean>>;
  consumed: Set<string>;
  /** `strict` from the `options` object, which is not kept as an extra parameter. */
  strictFromOptions: boolean;
} {
  const values: Partial<
    Record<(typeof MSSQL_URL_TLS_FIELDS)[number], boolean>
  > = {};
  const consumed = new Set<string>();
  let strictFromOptions = false;

  let options: unknown = conn.options;
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch {
      options = undefined;
    }
  }
  // An explicit query param wins over the `options` object.
  const sources: Record<string, unknown>[] = [
    options && typeof options === 'object'
      ? (options as Record<string, unknown>)
      : {},
    conn,
  ];
  for (const [index, source] of sources.entries()) {
    for (const [key, value] of Object.entries(source)) {
      const field = mssqlUrlTlsField(key);
      if (!field) continue;
      if (field === 'encrypt' && isStrictEncrypt(value)) {
        values.encrypt = true;
        if (index === 0) strictFromOptions = true;
        continue;
      }
      const parsed = urlBoolean(value);
      if (parsed === undefined) continue;
      values[field] = parsed;
      if (index === 1) consumed.add(key);
    }
  }
  return { values, consumed, strictFromOptions };
}

/**
 * The flat SQL auth fields a parsed connection URL fills (the knex config
 * `urlToConfig` returns). Unknown URL parameters become extra parameters.
 */
export function sqlAuthConfigFromKnexConfig(
  knexConfig?: { client?: string; connection?: Record<string, any> } | null
): SqlAuthConnectionConfig {
  const conn = knexConfig?.connection ?? {};
  const {
    host,
    server,
    port,
    user,
    username,
    password,
    database,
    ssl,
    ...rest
  } = conn;

  const out: SqlAuthConnectionConfig = {};
  if (host ?? server) out.host = String(host ?? server);
  if (port !== undefined && port !== null && port !== '')
    out.port = String(port);
  if (user ?? username) out.username = String(user ?? username);
  if (password !== undefined && password !== null && password !== '')
    out.password = String(password);
  if (database) out.database = String(database);
  if (ssl !== undefined && ssl !== null && ssl !== false && ssl !== 'false') {
    out.sslMode = sslModeFromConfig(ssl);
  }

  // SQL Server reads TLS from these fields only, so the URL must set them.
  const mssqlTls =
    knexConfig?.client === ClientType.MSSQL ? mssqlTlsFromUrl(conn) : null;
  if (mssqlTls) Object.assign(out, mssqlTls.values);

  const extra = Object.fromEntries(
    Object.entries(rest).filter(
      ([key, value]) =>
        !RESERVED_CONNECTION_KEYS.has(key) &&
        !mssqlTls?.consumed.has(key) &&
        value !== undefined &&
        value !== null &&
        typeof value !== 'object'
    )
  );
  if (
    mssqlTls?.strictFromOptions &&
    !isMssqlStrictEncrypt({ extraParams: extra })
  )
    extra['options.encrypt'] = 'strict';
  if (Object.keys(extra).length) out.extraParams = extra;

  return out;
}
