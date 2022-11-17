import { NcContext } from '.';
const mysql = require('mysql2');
const { Client } = require('pg');

import { PromisedDatabase } from 'promised-sqlite3';
const sqliteDb = new PromisedDatabase();

const isMysql = (context: NcContext) => context.dbType === 'mysql';

const isSqlite = (context: NcContext) => context.dbType === 'sqlite';

const isPg = (context: NcContext) => context.dbType === 'pg';

const pg_credentials = () => ({
  user: 'postgres',
  host: 'localhost',
  database: `sakila_${process.env.TEST_PARALLEL_INDEX}`,
  password: 'password',
  port: 5432,
});

const pgExec = async (query: string) => {
  // open pg client connection
  const client = new Client(pg_credentials());
  await client.connect();

  await client.query(query);
  await client.end();
};

const mysqlExec = async query => {
  // creates a new mysql connection using credentials from cypress.json env's
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
  const parallelIndex = process.env.TEST_PARALLEL_INDEX;
  const rootProjectDir = __dirname.replace('/tests/playwright/setup', '');
  await sqliteDb.open(`${rootProjectDir}/packages/nocodb/test_sakila_${parallelIndex}.db`);

  await sqliteDb.run(query);
  await sqliteDb.close();
}

export { sqliteExec, mysqlExec, isMysql, isSqlite, isPg, pgExec };
