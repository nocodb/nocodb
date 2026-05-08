import { type BoolType, SSLUsage } from 'nocodb-sdk'
import { ClientType } from '~/lib/enums'

// todo: move to noco-sdk
export enum NcProjectType {
  DB = 'database',
}

export enum CertTypes {
  ca = 'ca',
  cert = 'cert',
  key = 'key',
}

type ConnectionSsl = Record<CertTypes, string> | 'no-verify' | 'true'

interface CommonConnectionProps {
  database?: string
  ssl?: ConnectionSsl
  connection?: {
    filename?: string
  }
}

export type ProjectConnection = CommonConnectionProps &
  (DefaultConnection | SQLiteConnection | D1Connection | SnowflakeConnection | DatabricksConnection)

export interface ProjectCreateForm {
  title: string
  dataSource: {
    client: ClientType
    connection: ProjectConnection
    searchPath?: string[]
  }
  inflection: {
    inflectionColumn?: string
    inflectionTable?: string
  }
  sslUse: SSLUsage
  extraParameters: { key: string; value: string }[]
  is_private?: BoolType
  is_schema_readonly?: BoolType
  is_data_readonly?: BoolType
  fk_integration_id?: string
}

export interface DefaultConnection {
  host: string
  database: string
  user: string
  password: string
  port: number | string
  ssl?: ConnectionSsl
}

export interface SQLiteConnection {
  client: ClientType.SQLITE
  database: string
  connection: {
    filename?: string
  }
  useNullAsDefault?: boolean
}

export interface D1Connection {
  accountId: string
  databaseId: string
  apiToken: string
}

export interface SnowflakeConnection {
  account: string
  username: string
  password: string
  warehouse: string
  database: string
  schema: string
}

export interface DatabricksConnection {
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
    text: 'PostgreSQL',
    value: ClientType.PG,
  },
  {
    text: 'SQLite',
    value: ClientType.SQLITE,
  },
  {
    text: 'Cloudflare D1',
    value: ClientType.D1,
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
  | Exclude<ClientType, ClientType.SQLITE | ClientType.D1 | ClientType.SNOWFLAKE | ClientType.DATABRICKS>
  | 'tidb'
  | 'yugabyte'
  | 'citusdb'
  | 'cockroachdb'
  | 'greenplum'

const sampleConnectionData: { [key in ConnectionClientType]: DefaultConnection } & { [ClientType.SQLITE]: SQLiteConnection } & {
  [ClientType.D1]: D1Connection
} & {
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
  [ClientType.SQLITE]: {
    client: ClientType.SQLITE,
    database: homeDir,
    connection: {
      filename: homeDir,
    },
    useNullAsDefault: true,
  },
  [ClientType.D1]: {
    accountId: '',
    databaseId: '',
    apiToken: '',
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
}

export const getDefaultConnectionConfig = (client: ClientType): ProjectCreateForm['dataSource'] => {
  return {
    client,
    connection: sampleConnectionData[client],
    searchPath: [ClientType.PG].includes(client) ? (client === ClientType.PG ? ['public'] : ['dbo']) : undefined,
  }
}

const errorHandlers = [
  {
    messages: ['unable to get local issuer certificate', 'self signed certificate in certificate chain'],
    codes: ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'SELF_SIGNED_CERT_IN_CHAIN'],
    action: {
      connection: {
        ssl: {
          rejectUnauthorized: false,
        },
      },
    },
  },
  {
    messages: ['SSL is required'],
    codes: ['28000'], // PostgreSQL error code for invalid authorization specification
    action: {
      connection: {
        ssl: true,
      },
    },
  },
  {
    messages: ['The server does not support SSL connections'],
    codes: ['08P01'], // PostgreSQL error code for protocol violation
    action: {
      connection: {
        ssl: false,
      },
    },
  },
]

function generateConfigFix(e: any) {
  for (const handler of errorHandlers) {
    const errorMessage = e?.response?.data?.msg
    const errorCode = e?.response?.data?.sql_code

    if (!errorMessage && !errorCode) return

    const messageMatches =
      errorMessage && handler.messages.some((msg) => errorMessage?.toLowerCase()?.includes?.(msg?.toLowerCase()))
    const codeMatches = errorCode && handler.codes.includes(errorCode)

    if (messageMatches || codeMatches) {
      return handler.action
    }
  }
}

export { generateConfigFix, SSLUsage }
