import { type BoolType, SSLUsage } from 'nocodb-sdk'
import { ClientType } from '~/lib/enums'

// todo: move to noco-sdk
export enum NcProjectType {
  DB = 'database',
}

interface ProjectCreateForm {
  title: string
  dataSource: {
    client: ClientType
    connection: DefaultConnection | SQLiteConnection | SnowflakeConnection | DatabricksConnection
    searchPath?: string[]
  }
  inflection: {
    inflectionColumn?: string
    inflectionTable?: string
  }
  sslUse?: SSLUsage
  extraParameters: { key: string; value: string }[]
  is_private?: BoolType
  is_schema_readonly?: BoolType
  is_data_readonly?: BoolType
  fk_integration_id?: string
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

interface DatabricksConnection {
  token: string
  host: string
  path: string
  database: string
  schema: string
}

const defaultHost = 'localhost'

export { getTestDatabaseName } from 'nocodb-sdk'

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
  {
    text: 'Databricks',
    value: ClientType.DATABRICKS,
  },
]

export const clientTypesMap = clientTypes.reduce((acc, curr) => {
  acc[curr.value] = curr
  return acc
}, {} as Record<string, (typeof clientTypes)[0]>)

const homeDir = ''

type ConnectionClientType =
  | Exclude<ClientType, ClientType.SQLITE | ClientType.SNOWFLAKE | ClientType.DATABRICKS>
  | 'tidb'
  | 'yugabyte'
  | 'citusdb'
  | 'cockroachdb'
  | 'oracledb'
  | 'greenplum'

const sampleConnectionData: { [key in ConnectionClientType]: DefaultConnection } & { [ClientType.SQLITE]: SQLiteConnection } & {
  [ClientType.SNOWFLAKE]: SnowflakeConnection
} & { [ClientType.DATABRICKS]: DatabricksConnection } = {
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
    account: 'LOCATOR.REGION',
    username: 'USERNAME',
    password: 'PASSWORD',
    warehouse: 'COMPUTE_WH',
    database: 'DATABASE',
    schema: 'PUBLIC',
  },
  [ClientType.DATABRICKS]: {
    token: 'dapiPLACEHOLDER',
    host: 'PLACEHOLDER.cloud.databricks.com',
    path: '/sql/1.0/warehouses/PLACEHOLDER',
    database: 'database',
    schema: 'default',
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

enum CertTypes {
  ca = 'ca',
  cert = 'cert',
  key = 'key',
}

export { SSLUsage, CertTypes, ProjectCreateForm, DefaultConnection, SQLiteConnection, SnowflakeConnection, DatabricksConnection }
