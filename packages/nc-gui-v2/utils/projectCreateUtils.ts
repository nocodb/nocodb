import { adjectives, animals, starWars, uniqueNamesGenerator } from 'unique-names-generator'
import type { ClientType, ProjectCreateForm } from '~/lib/types'

const testDataBaseNames = {
  mysql2: null,
  mysql: null,
  pg: 'postgres',
  oracledb: 'xe',
  mssql: undefined,
  sqlite3: 'a.sqlite',
}

export const getTestDatabaseName = (db: { client: ClientType; connection?: { database?: string } }) => {
  if (db.client === 'pg') return db.connection?.database
  return testDataBaseNames[db.client as keyof typeof testDataBaseNames]
}

export const clientTypes = [
  {
    text: 'MySql',
    value: 'mysql2',
  },
  {
    text: 'MSSQL',
    value: 'mssql',
  },
  {
    text: 'PostgreSQL',
    value: 'pg',
  },
  {
    text: 'SQLite',
    value: 'sqlite3',
  },
]

const homeDir = ''
const sampleConnectionData: Record<ClientType | string, ProjectCreateForm['dataSource']['connection']> = {
  pg: {
    host: 'localhost',
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
  mysql2: {
    host: 'localhost',
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
  vitess: {
    host: 'localhost',
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
  tidb: {
    host: 'localhost',
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
    host: 'localhost',
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
    host: 'localhost',
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
    host: 'localhost',
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
    host: 'localhost',
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
  mssql: {
    host: 'localhost',
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
  oracledb: {
    host: 'localhost',
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
  sqlite3: {
    client: 'sqlite3',
    database: homeDir,
    connection: {
      filename: homeDir,
    },
    useNullAsDefault: true,
  },
}

export const getDefaultConnectionConfig = (client: ClientType): ProjectCreateForm['dataSource'] => {
  return {
    client,
    connection: sampleConnectionData[client],
  }
}

export const projectTitleValidator = {
  validator: (rule: any, value: any, callback: (errMsg?: string) => void) => {
    if (value?.length > 50) {
      callback('Project name exceeds 50 characters')
    }
    callback()
  },
}
export const fieldRequiredValidator = {
  required: true,
  message: 'Field is required',
}

export const sslUsage = ['No', 'Preferred', 'Required', 'Required-CA', 'Required-IDENTITY']

export const generateUniqueName = () => {
  return uniqueNamesGenerator({
    dictionaries: [[starWars], [adjectives, animals]][Math.floor(Math.random() * 2)],
  })
    .toLowerCase()
    .replace(/[ -]/g, '_')
}
