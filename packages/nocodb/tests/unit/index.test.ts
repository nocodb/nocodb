import 'mocha';

import knex from 'knex';
import { dbName } from './dbConfig';
import restTests from './rest/index.test';

process.env.NODE_ENV = 'test';
process.env.TEST = 'test';
process.env.NC_DISABLE_CACHE = 'true';

const setupTestMetaDb = async () => {
  const knexClient = knex({
    client: 'mysql2',
    connection: {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'password',
    },
  });
  
  try {
    await knexClient.raw(`DROP DATABASE ${dbName}`);
  } catch (e) {}
  
  await knexClient.raw(`CREATE DATABASE ${dbName}`);
}

(async function() {
  await setupTestMetaDb();

  restTests();

  run();
})();