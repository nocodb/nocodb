/// <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)
const { rmdir, copyFile } = require("fs");

// https://stackoverflow.com/questions/61934443/read-excel-files-in-cypress
const readXlsx = require("./read-xlsx");
const makeServer = require('./server')
/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
module.exports = (on, config) => {
    // `on` is used to hook into various events Cypress emits
    // `config` is the resolved Cypress config

    // register utility tasks to read and parse Excel files
    on("task", {
        copyFile() {
          console.log("copyFile", __dirname)
          return new Promise((resolve, reject) => {
              copyFile("./scripts/cypress-v2/fixtures/quickTest/noco_0_91_7.db", "./packages/nocodb/noco.db", (err) => {
                  if(err) {
                      console.log(err)
                      return reject(err)
                  }
                  resolve(null);
              })
          })
        },
        deleteFolder(folderName) {
            console.log("deleting folder %s", folderName);

            return new Promise((resolve, reject) => {
                rmdir(
                    folderName,
                    { maxRetries: 10, recursive: true },
                    (err) => {
                        if (err) {
                            console.error(err);

                            return reject(err);
                        }

                        resolve(null);
                    }
                );
            });
        },
        readXlsx: readXlsx.read,
        readSheetList: readXlsx.sheetList,
        log(message) {
            console.log(`##Cypress>> ${message}`);
            return null;
        },
        queryDb: (query) => {
            return queryTestDb(query, config);
        },
        sqliteExec: (query) => {
            _sqliteExec(query);
            return null;
        },
        sqliteExecReturnValue: (query) => {
            return _sqliteExecReturnValue(query);
        },
        pgExec: (query) => {
            _pgExec(query);
            return null;
        },
    });

    let server, port, close

    on('before:spec', async (spec) => {
        // we can customize the server based on the spec about to run
        const info = await makeServer()
        // save the server instance information
        server = info.server
        port = info.port
        close = info.close
        console.log('started the server on port %d', port)
    })

    on('after:spec', async (spec) => {
        if (!server) {
            console.log('no server to close')
            return
        }
        await close()
        console.log('closed the server running on port %d', port)
    })
};

// mysql connection
// https://gist.github.com/fityanos/0a345e9e9de498b6c629f78e6b2835f5

const mysql = require("mysql2");
function queryTestDb(query, config) {
    // creates a new mysql connection using credentials from cypress.json env's
    const connection = mysql.createConnection(config.env.db);
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

// sqlite connection
const sqlite3 = require("sqlite3").verbose();
function _sqliteExecReturnValue(query) {
    // open the database
    console.log("Current directory: " + process.cwd());
    let db = new sqlite3.Database(
        "./scripts/cypress-v2/fixtures/sqlite-sakila/sakila.db",
        sqlite3.OPEN_READWRITE,
        (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log("Connected to the noco xcdb database.");
            }
        }
    );

    // exec query + disconnect to db as a Promise
    return new Promise((resolve, reject) => {
        db.get(query, [], (err, row) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                return resolve(row);
            }
        });
    });
}

function _sqliteExec(query) {
    // open the database
    console.log("Current directory: " + process.cwd());
    let db = new sqlite3.Database(
        "./scripts/cypress-v2/fixtures/sqlite-sakila/sakila.db",
        sqlite3.OPEN_READWRITE,
        (err) => {
            if (err) {
                console.error(err.message);
            } else {
                console.log("Connected to the noco xcdb database.");
            }
        }
    );

    db.serialize(() => {
        db.run(query);
    });

    db.close((err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log("Close the database connection.");
        }
    });
}

// pg connection
const { Pool, Client } = require("pg");
const pg_credentials = {
    user: "postgres",
    host: "localhost",
    database: "postgres",
    password: "password",
    port: 5432,
};
function _pgExec(query) {
    // open pg client connection
    const client = new Client(pg_credentials);
    client.connect();

    // query & terminate
    client.query(query, (err, res) => {
        console.log(err, res);
        client.end();
    });
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Raju Udava <sivadstala@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
