export const driverClientMapping = {
  mysql: 'mysql2',
  mariadb: 'mysql2',
  postgres: 'pg',
  postgresql: 'pg',
  sqlite: 'sqlite3',
};

export const defaultClientPortMapping = {
  mysql: 3306,
  mysql2: 3306,
  postgres: 5432,
  pg: 5432,
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
    max: (() => {
      const poolSize = parseInt(process.env.DB_MAX_POOL_SIZE || '10', 10);
      if (Number.isNaN(poolSize) || poolSize < 1) return 10;
      return Math.min(poolSize, 100);
    })(),
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
  SNOWFLAKE = 'snowflake',
  DATABRICKS = 'databricks',
}

export const CHATWOOT_IDENTITY_KEY = process.env.CHATWOOT_IDENTITY_KEY;

export const NC_DISABLE_SUPPORT_CHAT =
  process.env.NC_DISABLE_SUPPORT_CHAT === 'true';

export const NC_IFRAME_WHITELIST_DOMAINS =
  process.env.NC_IFRAME_WHITELIST_DOMAINS || '';
