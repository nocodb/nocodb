import 'mocha';
import authTests from './tests/auth.test';
import NcConfigFactory from '../../../lib/utils/NcConfigFactory';

const dbName = `test_meta`;

process.env.NODE_ENV = 'test';
process.env.TEST = 'test';
process.env[`DATABASE_URL`] = `mysql2://root:password@localhost:3306/${dbName}`;

const dbConfig = NcConfigFactory.urlToDbConfig(
  NcConfigFactory.extractXcUrlFromJdbc(process.env[`DATABASE_URL`])
);
dbConfig.connection.database = 'sakila';

authTests();
