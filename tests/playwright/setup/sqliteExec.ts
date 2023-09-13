import { AsyncDatabase } from 'promised-sqlite3';

async function sqliteExec(query) {
  const rootProjectDir = __dirname.replace('/scripts/playwright/setup', '');
  const sqliteDb = await AsyncDatabase.open(`${rootProjectDir}/packages/nocodb/test_noco.db`);
  await sqliteDb.run(query);
}

export default sqliteExec;
