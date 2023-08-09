import { ClientType } from '../lib'

// todo: move to noco-sdk
export enum NcProjectType {
  DB = 'database',
}

interface ProjectCreateForm {
  title: string
  dataSource: {
    client: ClientType
    connection: DefaultConnection | SQLiteConnection | SnowflakeConnection
    searchPath?: string[]
  }
  inflection: {
    inflectionColumn?: string
    inflectionTable?: string
  }
  sslUse?: SSLUsage
  extraParameters: { key: string; value: string }[]
}

interface DefaultConnection {
  host: string
  database: string
  user: string
  password: string
  port: number | string
  ssl?: Record<CertTypes, string> | 'no-verify' | 'true'
}

interface SQLiteConnection {
  client: ClientType.SQLITE
  database: string
  connection: {
    filename?: string
  }
  useNullAsDefault?: boolean
}

interface SnowflakeConnection {
  account: string
  username: string
  password: string
  warehouse: string
  database: string
  schema: string
}

const defaultHost = 'localhost'

const testDataBaseNames = {
  [ClientType.MYSQL]: null,
  mysql: null,
  [ClientType.PG]: 'postgres',
  oracledb: 'xe',
  [ClientType.MSSQL]: undefined,
  [ClientType.SQLITE]: 'a.sqlite',
}

export const getTestDatabaseName = (db: { client: ClientType; connection?: { database?: string } }) => {
  if (db.client === ClientType.PG || db.client === ClientType.SNOWFLAKE) return db.connection?.database
  return testDataBaseNames[db.client as keyof typeof testDataBaseNames]
}

export const clientTypes = [
  {
    text: 'MySql',
    value: ClientType.MYSQL,
  },
  {
    text: 'MSSQL',
    value: ClientType.MSSQL,
  },
  {
    text: 'PostgreSQL',
    value: ClientType.PG,
  },
  {
    text: 'SQLite',
    value: ClientType.SQLITE,
  },
  {
    text: 'Snowflake',
    value: ClientType.SNOWFLAKE,
  },
]

const homeDir = ''

type ConnectionClientType =
  | Exclude<ClientType, ClientType.SQLITE | ClientType.SNOWFLAKE>
  | 'tidb'
  | 'yugabyte'
  | 'citusdb'
  | 'cockroachdb'
  | 'oracledb'
  | 'greenplum'

const sampleConnectionData: { [key in ConnectionClientType]: DefaultConnection } & { [ClientType.SQLITE]: SQLiteConnection } & {
  [ClientType.SNOWFLAKE]: SnowflakeConnection
} = {
  [ClientType.PG]: {
    host: defaultHost,
    port: '5432',
    user: 'postgres',
    password: 'password',
    database: '_test',
  },
  [ClientType.MYSQL]: {
    host: defaultHost,
    port: '3306',
    user: 'root',
    password: 'password',
    database: '_test',
  },
  [ClientType.VITESS]: {
    host: defaultHost,
    port: '15306',
    user: 'root',
    password: 'password',
    database: '_test',
  },
  [ClientType.MSSQL]: {
    host: defaultHost,
    port: 1433,
    user: 'sa',
    password: 'Password123.',
    database: '_test',
  },
  [ClientType.SQLITE]: {
    client: ClientType.SQLITE,
    database: homeDir,
    connection: {
      filename: homeDir,
    },
    useNullAsDefault: true,
  },
  [ClientType.SNOWFLAKE]: {
    account: 'account',
    username: 'username',
    password: 'password',
    warehouse: 'warehouse',
    database: 'database',
    schema: 'schema',
  },
  tidb: {
    host: defaultHost,
    port: '4000',
    user: 'root',
    password: '',
    database: '_test',
  },
  yugabyte: {
    host: defaultHost,
    port: '5432',
    user: 'postgres',
    password: '',
    database: '_test',
  },
  citusdb: {
    host: defaultHost,
    port: '5432',
    user: 'postgres',
    password: '',
    database: '_test',
  },
  cockroachdb: {
    host: defaultHost,
    port: '5432',
    user: 'postgres',
    password: '',
    database: '_test',
  },
  greenplum: {
    host: defaultHost,
    port: '5432',
    user: 'postgres',
    password: '',
    database: '_test',
  },
  oracledb: {
    host: defaultHost,
    port: '1521',
    user: 'system',
    password: 'Oracle18',
    database: '_test',
  },
}

export const getDefaultConnectionConfig = (client: ClientType): ProjectCreateForm['dataSource'] => {
  return {
    client,
    connection: sampleConnectionData[client],
    searchPath: [ClientType.PG, ClientType.MSSQL].includes(client)
      ? client === ClientType.PG
        ? ['public']
        : ['dbo']
      : undefined,
  }
}

enum SSLUsage {
  No = 'No',
  Allowed = 'Allowed',
  Preferred = 'Preferred',
  Required = 'Required',
  RequiredWithCa = 'Required-CA',
  RequiredWithIdentity = 'Required-Identity',
}

enum CertTypes {
  ca = 'ca',
  cert = 'cert',
  key = 'key',
}

export { SSLUsage, CertTypes, ProjectCreateForm, DefaultConnection, SQLiteConnection, SnowflakeConnection }
