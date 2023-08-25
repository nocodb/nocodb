const { DOCKER_DB_HOST, DOCKER_DB_PORT } = process.env;

export default {
  title: 'default',
  envs: {
    _noco: {
      api: {},
      db: [
        {
          client: 'mssql',
          connection: {
            host: DOCKER_DB_HOST || 'localhost',
            port: DOCKER_DB_PORT ? parseInt(DOCKER_DB_PORT, 10) : null || 1433,
            user: 'sa',
            password: 'Password123.',
            database: 'default_dev',
          },
          meta: {
            tn: 'nc_evolutions',
            dbAlias: 'primary',
          },
        },
      ],
    },
    test: {
      api: {},
      db: [
        {
          client: 'mssql',
          connection: {
            host: DOCKER_DB_HOST || 'localhost',
            port: DOCKER_DB_PORT ? parseInt(DOCKER_DB_PORT) : null || 1433,
            user: 'sa',
            password: 'Password123.',
            database: 'default_test',
          },
          meta: {
            tn: 'nc_evolutions',
            dbAlias: 'primary',
          },
        },
      ],
    },
  },
  workingEnv: '_noco',
  meta: {
    version: '0.5',
    seedsFolder: 'seeds',
    queriesFolder: 'queries',
    apisFolder: 'apis',
    orm: 'sequelize',
    router: 'express',
  },
};
