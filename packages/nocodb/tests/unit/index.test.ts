import 'mocha';

import knex from 'knex';

import restTests from './rest/index.test';
import modelTests from './model/index.test';
import TestDbMngr from './TestDbMngr'

process.env.NODE_ENV = 'test';
process.env.TEST = 'test';
process.env.NC_DISABLE_CACHE = 'true';
process.env.NC_DISABLE_TELE = 'true';

const setupTestMetaDb = async () => {
  const knexClient = knex(TestDbMngr.getMetaDbConfig());
  const dbName = TestDbMngr.dbName;
  
  try {
    await knexClient.raw(`DROP DATABASE ${dbName}`);
  } catch (e) {}
  
  await knexClient.raw(`CREATE DATABASE ${dbName}`);
}

(async function() {
  await TestDbMngr.init();

  await setupTestMetaDb();

  modelTests();
  restTests();

  run();
})();