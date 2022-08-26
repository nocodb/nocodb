import { ClientType } from '~/lib'

export interface ProjectCreateForm {
  title: string
  dataSource: {
    client: ClientType
    connection: DefaultConnection | SQLiteConnection
    searchPath?: string[]
  }
  inflection: {
    inflectionColumn?: string
    inflectionTable?: string
  }
  sslUse?: SSLUsage
  extraParameters: { key: string; value: string }[]
}

export interface DefaultConnection {
  host: string
  database: string
  user: string
  password: string
  port: number | string
  ssl?: Record<CertTypes, string> | 'true'
}

export interface SQLiteConnection {
  client: ClientType.SQLITE
  database: string
  connection: {
    filename?: string
  }
  useNullAsDefault?: boolean
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
  if (db.client === ClientType.PG) return db.connection?.database
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
]

const homeDir = ''

type ConnectionClientType =
  | Exclude<ClientType, ClientType.SQLITE>
  | 'tidb'
  | 'yugabyte'
  | 'citusdb'
  | 'cockroachdb'
  | 'oracledb'
  | 'greenplum'

const sampleConnectionData: { [key in ConnectionClientType]: DefaultConnection } & { [ClientType.SQLITE]: SQLiteConnection } = {
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

export { SSLUsage, CertTypes }
