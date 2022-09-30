import fs from 'fs';
import Knex from 'knex';

const setupSakilaSqlite = async (metaKnex: Knex) => {
  const config = metaKnex.client.config;
  await metaKnex.destroy();
  const rootDir = __dirname.replace(
    'packages/nocodb/src/lib/services/test/TestResetService',
    ''
  );
  if (fs.existsSync(`${rootDir}/packages/nocodb/test_noco.db`)) {
    fs.unlinkSync(`${rootDir}/packages/nocodb/test_noco.db`);
  }
  fs.copyFileSync(
    `${rootDir}/scripts/cypress/fixtures/sqlite-sakila/sakila.db`,
    `${rootDir}/packages/nocodb/test_noco.db`
  );

  metaKnex = Knex(config);
  console.log('config', config);

  // await metaKnex.client.destroy();
  // console.log('destroyed');
  // await metaKnex.client.initializePool(config);
  // console.log('initializePool');
  // await metaKnex.client.acquireConnection();
  // console.log('acquireConnection');
};

export default setupSakilaSqlite;
