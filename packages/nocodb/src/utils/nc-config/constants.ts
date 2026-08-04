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
