import { ClientType } from '~/lib'

export interface ProjectCreateForm {
  title: string
  dataSource: {
    client: ClientType
    connection:
      | {
          host: string
          database: string
          user: string
          password: string
          port: number | string
          ssl?: Record<string, string> | string
        }
      | {
          client?: ClientType.SQLITE
          database: string
          connection?: {
            filename?: string
          }
          useNullAsDefault?: boolean
        }
    searchPath?: string[]
  }
  inflection: {
    inflectionColumn?: string
    inflectionTable?: string
  }
  sslUse?: any
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
const sampleConnectionData: Record<ClientType | string, ProjectCreateForm['dataSource']['connection']> = {
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

export const sslUsage = ['No', 'Allowed', 'Preferred', 'Required', 'Required-CA', 'Required-IDENTITY']
