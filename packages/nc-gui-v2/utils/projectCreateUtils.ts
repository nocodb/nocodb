import { ClientType } from '~/lib/enums'

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
          ssl?: Record<string, string>
          searchPath?: string[]
        }
      | {
          client?: ClientType.SQLITE
          database: string
          connection?: {
            filename?: string
          }
          useNullAsDefault?: boolean
        }
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
    searchPath: ['public'],
    ssl: {
      ca: '',
      key: '',
      cert: '',
    },
  },
  [ClientType.MYSQL]: {
    host: defaultHost,
    port: '3306',
    user: 'root',
    password: 'password',
    database: '_test',
    ssl: {
      ca: '',
      key: '',
      cert: '',
    },
  },
  [ClientType.VITESS]: {
    host: defaultHost,
    port: '15306',
    user: 'root',
    password: 'password',
    database: '_test',
    ssl: {
      ca: '',
      key: '',
      cert: '',
    },
  },
  [ClientType.MSSQL]: {
    host: defaultHost,
    port: 1433,
    user: 'sa',
    password: 'Password123.',
    database: '_test',
    searchPath: ['dbo'],
    ssl: {
      ca: '',
      key: '',
      cert: '',
    },
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
    ssl: {
      ca: '',
      key: '',
      cert: '',
    },
  },
  yugabyte: {
    host: defaultHost,
    port: '5432',
    user: 'postgres',
    password: '',
    database: '_test',
    ssl: {
      ca: '',
      key: '',
      cert: '',
    },
  },
  citusdb: {
    host: defaultHost,
    port: '5432',
    user: 'postgres',
    password: '',
    database: '_test',
    ssl: {
      ca: '',
      key: '',
      cert: '',
    },
  },
  cockroachdb: {
    host: defaultHost,
    port: '5432',
    user: 'postgres',
    password: '',
    database: '_test',
    ssl: {
      ca: '',
      key: '',
      cert: '',
    },
  },
  greenplum: {
    host: defaultHost,
    port: '5432',
    user: 'postgres',
    password: '',
    database: '_test',
    ssl: {
      ca: '',
      key: '',
      cert: '',
    },
  },
  oracledb: {
    host: defaultHost,
    port: '1521',
    user: 'system',
    password: 'Oracle18',
    database: '_test',
    ssl: {
      ca: '',
      key: '',
      cert: '',
    },
  },
}

export const getDefaultConnectionConfig = (client: ClientType): ProjectCreateForm['dataSource'] => {
  return {
    client,
    connection: sampleConnectionData[client],
  }
}

export const sslUsage = ['No', 'Preferred', 'Required', 'Required-CA', 'Required-IDENTITY']
