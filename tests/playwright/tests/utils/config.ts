const knexConfig = {
  pg: {
    client: 'pg',
    connection: {
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'password',
      database: 'postgres',
      multipleStatements: true,
    },
    searchPath: ['public', 'information_schema'],
    pool: { min: 0, max: 1 },
  },
  mysql: {
    client: 'mysql2',
    connection: {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'password',
      database: 'sakila',
      multipleStatements: true,
    },
    pool: { min: 0, max: 5 },
  },
  sqlite: {
    client: 'sqlite3',
    connection: {
      filename: './mydb.sqlite3',
    },
    useNullAsDefault: true,
    pool: { min: 0, max: 5 },
  },
};

function getKnexConfig({ dbName, dbType }: { dbName: string; dbType: string }) {
  const config = knexConfig[dbType];

  if (dbType === 'sqlite') {
    config.connection.filename = `./${dbName}.sqlite3`;
    return config;
  }
  config.connection.database = dbName;
  return config;
}

export { getKnexConfig };
