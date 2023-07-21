import { knownQueryParams } from './src/lib/utils/NcConfigFactory';

const entities = [
  `${__dirname}/src/database/entities/*.ts`,
  `${__dirname}/src/database/entities/*.js`,
];

const migrations = [
  `${__dirname}/src/database/migrations/*.ts`,
  `${__dirname}/src/database/migrations/*.js`,
];

const ormConfig = () => {
  const url = new URL(process.env.NC_DB || '');

  const parsedQuery: any = {};
  for (const [key, value] of url.searchParams.entries()) {
    const fnd = knownQueryParams.find(
      (param) => param.parameter === key || param.aliases.includes(key)
    );
    if (fnd) {
      parsedQuery[fnd.parameter] = value;
    } else {
      parsedQuery[key] = value;
    }
  }

  const config = {
    type: 'postgres',
    host: url.hostname,
    port: +url.port,
    username: parsedQuery.user,
    password: parsedQuery.password,
    database: parsedQuery.database,
    entities,
    migrations,
    migrationsRun: false,
    cli: {
      migrationsDir: `src/database/migrations`,
    },
    synchronize: false,
    dropSchema: false,
  };
  return config;
};

module.exports = ormConfig();
