import 'mocha';
import authTests from './tests/auth.test';
import projectTests from './tests/project.test';
import tableTests from './tests/table.test';
import tableRowTests from './tests/tableRow.test';
import viewRowTests from './tests/viewRow.test';
import knex from 'knex';
import { dbName } from './dbConfig';

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

  authTests();
  projectTests();
  tableTests();
  tableRowTests();
  viewRowTests();

  run();
})();