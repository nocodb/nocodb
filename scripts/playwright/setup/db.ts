import { NcContext } from ".";

import { PromisedDatabase } from "promised-sqlite3";

const sqliteDb = new PromisedDatabase(); 

const isMysql = (context: NcContext) => context.dbType === 'mysql';

const isSqlite = (context: NcContext) => context.dbType === 'sqlite';

const isPg = (context: NcContext) => context.dbType === 'pg';

const mysql = require("mysql2");
const mysqlExec = async (query) => {
  // creates a new mysql connection using credentials from cypress.json env's
  const connection = mysql.createConnection({
    "host": "localhost",
    "user": "root",
    "password": "password",
    "database": `test_sakila_${process.env.TEST_PARALLEL_INDEX}`
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
}

async function sqliteExec(query) {
  const rootProjectDir = __dirname.replace("/scripts/playwright/setup", "");
  await sqliteDb.open(`${rootProjectDir}/packages/nocodb/test_noco.db`);

  await sqliteDb.run(query);
}

export { sqliteExec, mysqlExec, isMysql, isSqlite, isPg };