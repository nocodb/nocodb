import { NcContext } from '.';
const mysql = require('mysql2');
const { Client } = require('pg');

import { AsyncDatabase } from 'promised-sqlite3';

const isMysql = (context: NcContext) => context.dbType === 'mysql';

const isSqlite = (context: NcContext) => context.dbType === 'sqlite';

const isPg = (context: NcContext) => context.dbType === 'pg';

const isEE = () => process.env.EE === 'true';

// run all the tests for PG; disable some tests for mysql, sqlite to reduce CI time
//
const enableQuickRun = () => (process.env.CI ? process.env.E2E_DB_TYPE : process.env.E2E_DEV_DB_TYPE) !== 'pg';

const pg_credentials = (context: NcContext) => ({
  user: 'postgres',
  host: 'localhost',
  // todo: Hack to resolve issue with pg resetting
  database: `sakila${context.workerId}`,
  password: 'password',
  port: 5432,
});

const pgExec = async (query: string, context: NcContext) => {
  // open pg client connection
  const client = new Client(pg_credentials(context));
  await client.connect();

  await client.query(query);
  await client.end();
};

const mysqlExec = async query => {
  // creates a new mysql connection
  const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: `test_sakila_${process.env.TEST_PARALLEL_INDEX}`,
  });
  // start connection to db
  connection.connect();
  // exec query + disconnect to db as a Promise
  return new Promise((resolve, reject) => {
    connection.query(query, (error, results) => {
      if (error) reject(error);
      else {
        connection.end();
        // console.log(results)
        return resolve(results);
      }
    });
  });
};

async function sqliteExec(query) {
  try {
    const parallelIndex = process.env.TEST_PARALLEL_INDEX;
    const rootProjectDir = __dirname.replace('/tests/playwright/setup', '');
    const sqliteDb = await AsyncDatabase.open(`${rootProjectDir}/packages/nocodb/test_sakila_${parallelIndex}.db`);
    await sqliteDb.run(query);
    await sqliteDb.close();
  } catch (err) {
    console.error(err);
  }
}

export { sqliteExec, mysqlExec, isMysql, isSqlite, isPg, pgExec, isEE, enableQuickRun };
