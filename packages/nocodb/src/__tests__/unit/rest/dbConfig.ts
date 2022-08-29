import NcConfigFactory from '../../../lib/utils/NcConfigFactory';

const dbName = `test_meta`;
process.env[`DATABASE_URL`] = `mysql2://root:password@localhost:3306/${dbName}`;

const dbConfig = NcConfigFactory.urlToDbConfig(
  NcConfigFactory.extractXcUrlFromJdbc(process.env[`DATABASE_URL`])
);
dbConfig.connection.database = dbName;
dbConfig.meta = {
  tn: 'nc_evolutions',
  dbAlias: 'db',
  api: {
    type: 'rest',
    prefix: '',
    graphqlDepthLimit: 10,
  },
  inflection: {
    tn: 'camelize',
    column_name: 'camelize',
  },
} as any;

export { dbConfig, dbName };
