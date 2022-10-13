const mysql = require("mysql2");

const mysqlExec = async (query) => {
  // creates a new mysql connection using credentials from cypress.json env's
  const connection = mysql.createConnection({
    "host": "127.0.0.1",
    "user": "root",
    "password": "password"
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

export default mysqlExec;