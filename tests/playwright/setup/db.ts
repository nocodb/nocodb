import { NcContext } from '.';
const mysql = require('mysql2');
const { Client } = require('pg');

import { PromisedDatabase } from 'promised-sqlite3';
const sqliteDb = new PromisedDatabase();

const isMysql = (context: NcContext) => context.dbType === 'mysql';

const isSqlite = (context: NcContext) => context.dbType === 'sqlite';

const isPg = (context: NcContext) => context.dbType === 'pg';

// hardwired for hub; this has to be configured to false in nocodb
// consider reading this from environment variable
const isHub = () => true;

const pg_credentials = (context: NcContext) => ({
  user: 'postgres',
  host: 'localhost',
  // todo: Hack to resolve issue with pg resetting
  database: `sakila_${context.workerId}`,
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
  const parallelIndex = process.env.TEST_PARALLEL_INDEX;
  const rootProjectDir = __dirname.replace('/tests/playwright/setup', '');
  await sqliteDb.open(`${rootProjectDir}/packages/nocodb-nest/test_sakila_${parallelIndex}.db`);

  await sqliteDb.run(query);
  await sqliteDb.close();
}

export { sqliteExec, mysqlExec, isMysql, isSqlite, isPg, pgExec, isHub };
