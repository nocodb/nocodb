const { PromisedDatabase } = require('promised-sqlite3');
const sqliteDb = new PromisedDatabase();

async function sqliteExec(query) {
  const rootProjectDir = __dirname.replace('/scripts/playwright/setup', '');
  await sqliteDb.open(`${rootProjectDir}/packages/nocodb/test_noco.db`);

  await sqliteDb.run(query);
}

export default sqliteExec;
