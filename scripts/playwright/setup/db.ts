import { NcContext } from ".";

import axios from "axios";

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
  try {
    await axios.post('http://localhost:8080/api/v1/meta/test/sqlite_exec', {
      "sql": query,
    });
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export { sqliteExec, mysqlExec, isMysql, isSqlite, isPg };