/* eslint-disable func-names */
// 'use strict';
const { promisify } = require("util");
const fs = require("fs");
const jsonfile = require("jsonfile");
const should = require("should");
const SqlClientFactory = require("../../SqlClient/lib/SqlClientFactory");

const TestUtil = require("./TestUtil");

const sqlStatements = require("./sql.statements");

const { DB_TYPE } = process.env;

let sqlType = "mysql";
let upStatement = null;
let downStatement = null;
let blogUp = null;
let blogDown = null;

let testNum = 0;

const sqlDbs = {
  sqlite: {
    sqlType: "sqlite",
    upStatement: sqlStatements.sqlite3.user.up,
    downStatement: sqlStatements.sqlite3.user.down,
    blogUp: sqlStatements.sqlite3.blog.up,
    blogDown: sqlStatements.sqlite3.blog.down
  }
  // mysql: {
  //   sqlType: "mysql",
  //   upStatement: sqlStatements.mysql.user.up,
  //   downStatement: sqlStatements.mysql.user.down,
  //   blogUp: sqlStatements.mysql.blog.up,
  //   blogDown: sqlStatements.mysql.blog.down
  // },
  // pg: {
  //   sqlType: "pg",
  //   upStatement: sqlStatements.pg.user.up,
  //   downStatement: sqlStatements.pg.user.down,
  //   blogUp: sqlStatements.pg.blog.up,
  //   blogDown: sqlStatements.pg.blog.down
  // },
  // mssql: {
  //   sqlType: "mssql",
  //   upStatement: sqlStatements.mssql.user.up,
  //   downStatement: sqlStatements.mssql.user.down,
  //   blogUp: sqlStatements.mssql.blog.up,
  //   blogDown: sqlStatements.mssql.blog.down
  // },
  // oracle: {
  //   sqlType: "oracle",
  //   upStatement: sqlStatements.oracledb.user.up,
  //   downStatement: sqlStatements.oracledb.user.down,
  //   blogUp: sqlStatements.oracledb.blog.up,
  //   blogDown: sqlStatements.oracledb.blog.down
  // }
};

let db = sqlDbs[DB_TYPE];

if (!db) {
  console.error("Invalid DB Type, running tests on sqlite", DB_TYPE);
  db = sqlDbs.sqlite;
}

// sqlDbs.forEach(function(db) {
describe("SqlMigratorCli : Tests", function() {
  before(async function() {
    try {
      await promisify(fs.unlink)("./config.xc.json");
    } catch (e) {
      console.log("..");
    }

    sqlType = db.sqlType;
    upStatement = db.upStatement;
    downStatement = db.downStatement;
    blogUp = db.blogUp;
    blogDown = db.blogDown;
    testNum = 0;
  });

  beforeEach(function(done) {
    console.log("\n", `${sqlType}:${testNum}`);
    testNum++;
    done();
  });

  it(`xmigrator init should pass`, async function() {
    this.timeout(20000);

    await TestUtil.cmdInit({
      args: ["i", sqlType]
    });
    await TestUtil.cmdInitVerify();
  });

  it(`xmigrator sync should pass`, async function() {
    this.timeout(20000);

    await TestUtil.cmdSync({
      args: ["s"]
    });

    await TestUtil.cmdSyncVerify();
  });

  it(`xmigrator migration create (first migration) should pass`, async function() {
    this.timeout(20000);

    await TestUtil.cmdMigrationCreate({
      args: ["m", "c"]
    });

    await TestUtil.cmdMigrationCreateVerify({
      upStatement,
      downStatement,
      recordsLength: 1,
      dbAlias: "primary"
    });
  });

  it(`xmigrator migration create (second migration) should pass`, async function() {
    this.timeout(20000);

    TestUtil.sleep();

    await TestUtil.cmdMigrationCreate({
      args: ["m", "c"]
    });

    await TestUtil.cmdMigrationCreateVerify({
      upStatement: blogUp,
      downStatement: blogDown,
      recordsLength: 2,
      dbAlias: "primary"
    });
  });

  it(`xmigrator migration up --step=1 (first migration) should pass`, async function() {
    this.timeout(20000);

    await TestUtil.cmdMigrationUp({
      args: ["m", "u"],
      steps: 1
    });

    await TestUtil.cmdMigrationUpVerify({
      recordsLength: 1,
      tn: "user"
    });
  });

  it(`xmigrator migration up --step=1 (second migration) should pass`, async function() {
    this.timeout(20000);

    await TestUtil.cmdMigrationUp({
      args: ["m", "u"],
      steps: 1
    });

    await TestUtil.cmdMigrationUpVerify({
      recordsLength: 2,
      tn: "blog"
    });
  });

  it(`xmigrator migration down should pass`, async function() {
    this.timeout(20000);

    await TestUtil.cmdMigrationDown({
      args: ["m", "d"]
    });

    await TestUtil.cmdMigrationDownVerify({
      recordsLength: 0,
      tn: "blog"
    });

    await TestUtil.cmdMigrationDownVerify({
      recordsLength: 0,
      tn: "user"
    });
  });

  it(`xmigrator migration up should pass`, async function() {
    await TestUtil.cmdMigrationUp({
      args: ["m", "u"]
    });

    await TestUtil.cmdMigrationUpVerify({
      recordsLength: 2,
      tn: "blog"
    });

    await TestUtil.cmdMigrationUpVerify({
      recordsLength: 2,
      tn: "user"
    });
  });

  it(`xmigrator migration down --steps=1 (first migration) should pass`, async function() {
    this.timeout(20000);

    await TestUtil.cmdMigrationDown({
      args: ["m", "d"],
      steps: 1
    });

    await TestUtil.cmdMigrationDownVerify({
      recordsLength: 1,
      tn: "blog"
    });
  });

  it(`xmigrator migration down --steps=1 (second migration) should pass`, async function() {
    this.timeout(20000);

    await TestUtil.cmdMigrationDown({
      args: ["m", "d"],
      steps: 1
    });

    await TestUtil.cmdMigrationDownVerify({
      recordsLength: 0,
      tn: "user"
    });
  });

  it(`xmigrator migration create (secondary - 1st migration) should pass`, async function() {
    this.timeout(20000);

    TestUtil.sleep();

    await TestUtil.cmdMigrationCreate({
      args: ["m", "c"],
      dbAlias: "db2"
    });
    //
    await TestUtil.cmdMigrationCreateVerify({
      upStatement,
      downStatement,
      recordsLength: 1,
      dbAlias: "db2"
    });
  });

  it(`xmigrator migration create (secondary - 2nd migration) should pass`, async function() {
    this.timeout(20000);

    TestUtil.sleep();

    await TestUtil.cmdMigrationCreate({
      args: ["m", "c"],
      dbAlias: "db2"
    });
    //
    await TestUtil.cmdMigrationCreateVerify({
      upStatement: blogUp,
      downStatement: blogDown,
      recordsLength: 2,
      dbAlias: "db2"
    });
  });

  it(`xmigrator migration up should pass db2`, async function() {
    await TestUtil.cmdMigrationUp({
      args: ["m", "u"],
      dbAlias: "db2"
    });

    await TestUtil.cmdMigrationUpVerify({
      recordsLength: 2,
      tn: "user",
      envIndex: 1
    });

    await TestUtil.cmdMigrationUpVerify({
      recordsLength: 2,
      tn: "blog",
      envIndex: 1
    });
  });

  it(`xmigrator migration down should pass`, async function() {
    this.timeout(20000);

    await TestUtil.cmdMigrationDown({
      args: ["m", "d"],
      dbAlias: "db2"
    });

    await TestUtil.cmdMigrationDownVerify({
      recordsLength: 0,
      envIndex: 1,
      tn: "user"
    });

    await TestUtil.cmdMigrationDownVerify({
      recordsLength: 0,
      envIndex: 1,
      tn: "blog"
    });
  });

  it(`xmigrator migration up --env test should pass`, async function() {
    await TestUtil.cmdMigrationUp({
      args: ["m", "u"],
      dbAlias: "db2",
      env: "test"
    });

    await TestUtil.cmdMigrationUpVerify({
      recordsLength: 2,
      tn: "user",
      envIndex: 1,
      env: "test"
    });

    await TestUtil.cmdMigrationUpVerify({
      recordsLength: 2,
      tn: "blog",
      envIndex: 1,
      env: "test"
    });
  });

  it(`xmigrator migration down --env test should pass`, async function() {
    this.timeout(20000);
    await TestUtil.cmdMigrationDown({
      args: ["m", "d"],
      dbAlias: "db2",
      env: "test"
    });

    await TestUtil.cmdMigrationDownVerify({
      recordsLength: 0,
      envIndex: 1,
      tn: "user",
      env: "test"
    });

    await TestUtil.cmdMigrationDownVerify({
      recordsLength: 0,
      envIndex: 1,
      tn: "blog",
      env: "test"
    });
  });

  it(`xmigrator clean --env=test --dbAlias=db2 should pass`, async function() {
    this.timeout(20000);

    await TestUtil.cmdMigrationClean({
      args: ["c"],
      env: "test",
      dbAlias: "db2"
    });

    let exists = false;

    // database exists in all environments
    const project = await promisify(jsonfile.readFile)("./config.xc.json");

    const key = "test";
    for (let i = 0; i < project.envs[key].length; ++i) {
      const connection = project.envs[key][i];
      if (connection.meta.dbAlias === "db2") {
        try {
          const sqlClient = SqlClientFactory.create(connection);
        } catch (e) {
          exists = false;
        }

        should.equal(
          exists,
          false,
          `${key}/${connection.connection.database} do not exists`
        );
      }
    }

    // migrations table exists in all environments
  });

  if (db.sqlType === "oracle") {
    console.log("\n\nPlease Drop All Database in Oracle Manually\n\n");
  } else {
    it(`xmigrator clean should pass`, async function() {
      this.timeout(20000);

      await TestUtil.cmdMigrationClean({
        args: ["c"]
      });

      await TestUtil.cmdMigrationCleanVerify();
      // migrations table exists in all environments
    });
  }
});
// });
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
