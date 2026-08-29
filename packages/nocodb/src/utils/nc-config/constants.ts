import { Logger } from '@nestjs/common';

export const driverClientMapping = {
  mysql: 'mysql2',
  mariadb: 'mysql2',
  postgres: 'pg',
  postgresql: 'pg',
  sqlite: 'sqlite3',
  oracle: 'oracledb',
};

export const defaultClientPortMapping = {
  mysql: 3306,
  mysql2: 3306,
  postgres: 5432,
  pg: 5432,
  mssql: 1433,
  oracledb: 1521,
};

export const defaultConnectionConfig: any = {
  // https://github.com/knex/knex/issues/97
  // timezone: process.env.NC_TIMEZONE || 'UTC',
  dateStrings: true,
};

// default knex options
export const defaultConnectionOptions = {
  pool: {
    min: 0,
    max: +process.env.NC_DB_POOL_MAX || 10,
  },
};

export const avoidSSL = [
  'localhost',
  '127.0.0.1',
  'host.docker.internal',
  '172.17.0.1',
];

export const knownQueryParams = [
  {
    parameter: 'database',
    aliases: ['d', 'db'],
  },
  {
    parameter: 'password',
    aliases: ['p'],
  },
  {
    parameter: 'user',
    aliases: ['u'],
  },
  {
    parameter: 'title',
    aliases: ['t'],
  },
  {
    parameter: 'keyFilePath',
    aliases: [],
  },
  {
    parameter: 'certFilePath',
    aliases: [],
  },
  {
    parameter: 'caFilePath',
    aliases: [],
  },
  {
    parameter: 'ssl',
    aliases: [],
  },
  {
    parameter: 'options',
    aliases: ['opt', 'opts'],
  },
];

export enum DriverClient {
  MYSQL = 'mysql2',
  MYSQL_LEGACY = 'mysql',
  PG = 'pg',
  SQLITE = 'sqlite3',
  MSSQL = 'mssql',
  ORACLE = 'oracledb',
  SNOWFLAKE = 'snowflake',
  DATABRICKS = 'databricks',
}

export const CHATWOOT_IDENTITY_KEY = process.env.CHATWOOT_IDENTITY_KEY;

export const NC_DISABLE_SUPPORT_CHAT =
  process.env.NC_DISABLE_SUPPORT_CHAT === 'true';

export const NC_IFRAME_WHITELIST_DOMAINS =
  process.env.NC_IFRAME_ALLOWED_DOMAINS ||
  process.env.NC_IFRAME_WHITELIST_DOMAINS ||
  '';

export const NC_DISABLE_GROUP_BY_LIMIT =
  process.env.NC_DISABLE_GROUP_BY_LIMIT === 'true' || false;

export const NC_DISABLE_GROUP_BY_AGG =
  process.env.NC_DISABLE_GROUP_BY_AGG === 'true' || false;

// Kill-switch for the single-scan bulkAggregate consolidation (PG) — when set,
// every bucket runs as its own derived subquery (legacy behavior).
export const NC_DISABLE_BULK_AGG_CONSOLIDATION =
  process.env.NC_DISABLE_BULK_AGG_CONSOLIDATION === 'true' || false;

// Per-query execution cap (ms) for expensive customer-data aggregation reads
// (count / groupBy / groupByCount / the optimised-path list count and
// aggregations). Bounds how long a single such query can pin a pooled DB
// connection: without it a runaway GROUP-BY-count over a large table holds one
// of only NC_DB_POOL_MAX connections for its full runtime, and a browser
// fan-out of such queries drains the pool and cascades 5xx across tenants.
// Enforced server-side on PG only, via `SET LOCAL statement_timeout` so
// Postgres cancels the query and frees the connection (see
// BaseModelSqlv2.execAndGetRows). Set to 0 to disable. Default 30s.
const DEFAULT_DATA_QUERY_TIMEOUT_MS = 30000;

// PG's `statement_timeout` GUC is a signed 32-bit int. A larger value makes the
// `SET LOCAL` itself fail with SQLSTATE 22023 *before* the query runs, which
// would turn every capped read into an error, so clamp rather than pass through.
const MAX_DATA_QUERY_TIMEOUT_MS = 2147483647;

let warnedInvalidDataQueryTimeout = false;

export const getDataQueryTimeout = (): number => {
  const raw = process.env.NC_DATA_QUERY_TIMEOUT_MS?.trim();

  if (!raw) {
    return DEFAULT_DATA_QUERY_TIMEOUT_MS;
  }

  // The whole string must be digits. `parseInt` alone silently accepts a unit
  // suffix, so `30s` would read as 30 *milliseconds* and cancel every
  // aggregation read on the instance — a plausible typo with an outage-shaped
  // blast radius. Reject it and keep the default instead.
  if (/^\d+$/.test(raw)) {
    return Math.min(parseInt(raw, 10), MAX_DATA_QUERY_TIMEOUT_MS);
  }

  if (!warnedInvalidDataQueryTimeout) {
    warnedInvalidDataQueryTimeout = true;
    new Logger('nc-config').warn(
      `Ignoring invalid NC_DATA_QUERY_TIMEOUT_MS="${raw}" — expected whole milliseconds (e.g. 30000, or 0 to disable). Using ${DEFAULT_DATA_QUERY_TIMEOUT_MS}ms.`,
    );
  }

  return DEFAULT_DATA_QUERY_TIMEOUT_MS;
};

export const NC_DISABLE_UNDO_REDO =
  process.env.NC_DISABLE_UNDO_REDO === 'true' || false;

const DEFAULT_THUMBNAIL_MAX_SIZE = 3 * 1024 * 1024;

export const getThumbnailMaxSize = () => {
  const envValue = process.env.NC_THUMBNAIL_MAX_SIZE;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_THUMBNAIL_MAX_SIZE;
};

// Cap on the request/response body size (bytes) for outgoing webhooks. Without
// it, axios buffers the entire response into a native Buffer (default
// maxContentLength is -1 = unlimited); a flood of webhook jobs each holding an
// unbounded body OOM-killed the worker (std::bad_alloc). 10 MB is generous for
// typical acknowledgement responses; operators can raise NC_WEBHOOK_MAX_BODY_SIZE.
const DEFAULT_WEBHOOK_MAX_BODY_SIZE = 10 * 1024 * 1024;

export const getWebhookMaxBodySize = () => {
  const envValue = process.env.NC_WEBHOOK_MAX_BODY_SIZE;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_WEBHOOK_MAX_BODY_SIZE;
};
