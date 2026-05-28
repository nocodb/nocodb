import fs from 'fs';
import process from 'process';
import { knex } from 'knex';
import SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import { jdbcToXcUrl, xcUrlToDbConfig } from '~/utils/nc-config';
import deepClone from '~/helpers/deepClone';
import type { Knex } from 'knex';
import type { DbConfig } from '~/interface/config';

export default class TestDbMngr {
  public static readonly dbName = 'test_meta';
  public static readonly sakilaDbName = 'test_sakila';
  // Data DB for internal/default (is_meta) sources. Normally the same client
  // as meta (pg/mysql/sqlite). Can be overridden to MSSQL via env so the suite
  // runs with pg meta + mssql data — NocoDB picks it up via NC_DATA_DB_JSON.
  public static readonly dataDbName = 'test_data';
  public static metaKnex: Knex;
  public static sakilaKnex: Knex;

  public static defaultConnection = {
    user: 'root',
    password: 'password',
    host: 'localhost',
    port: 3306,
    client: 'mysql2',
  };

  public static pgConnection = {
    user: 'postgres',
    password: 'password',
    host: 'localhost',
    port: 5432,
    client: 'pg',
  };

  public static connection: {
    user: string;
    password: string;
    host: string;
    port: number;
    client: string;
  } = TestDbMngr.defaultConnection;

  public static dbConfig: DbConfig;

  static populateConnectionConfig() {
    const { user, password, host, port, client } = TestDbMngr.defaultConnection;
    TestDbMngr.connection = {
      user: process.env['DB_USER'] || user,
      password: process.env['DB_PASSWORD'] || password,
      host: process.env['DB_HOST'] || host,
      port: Number(process.env['DB_PORT']) || port,
      client: process.env['DB_CLIENT'] || client,
    };

    console.log(TestDbMngr.connection);
  }

  static async testConnection(config: DbConfig) {
    try {
      console.log('Testing connection', TestDbMngr.connection);
      return await SqlMgrv2.testConnection(config);
    } catch (e) {
      console.log(e);
      return { code: -1, message: 'Connection invalid' };
    }
  }

  static async init() {
    TestDbMngr.populateConnectionConfig();

    // common for both pg and mysql
    if (await TestDbMngr.isDbConfigured()) {
      await TestDbMngr.connectDb();
    } else {
      console.log('Mysql is not configured. Switching to sqlite');
      await TestDbMngr.switchToSqlite();
    }
  }

  private static async isDbConfigured() {
    const { user, password, host, port, client } = TestDbMngr.connection;
    const config = xcUrlToDbConfig(
      `${client}://${user}:${password}@${host}:${port}`,
    );
    config.connection = {
      user,
      password,
      host,
      port,
    };
    const result = await TestDbMngr.testConnection(config as any);
    return result.code !== -1;
  }
  static async connectDb() {
    const { user, password, host, port, client } = TestDbMngr.connection;
    if (!process.env[`DATABASE_URL`]) {
      process.env[
        `DATABASE_URL`
      ] = `${client}://${user}:${password}@${host}:${port}/${TestDbMngr.dbName}`;
    }

    TestDbMngr.dbConfig = xcUrlToDbConfig(
      jdbcToXcUrl(process.env[`DATABASE_URL`]),
    ) as any;
    this.dbConfig.meta = {
      tn: 'nc_evolutions',
      dbAlias: 'db',
      api: {
        type: 'rest',
        prefix: '',
        graphqlDepthLimit: 10,
      },
      inflection: {
        tn: 'camelize',
        cn: 'camelize',
      },
    };

    await TestDbMngr.setupMeta();
    await TestDbMngr.setupSakila();
  }

  static async setupMeta() {
    if (TestDbMngr.metaKnex) {
      await TestDbMngr.metaKnex.destroy();
    }

    if (TestDbMngr.isSqlite()) {
      await TestDbMngr.resetMetaSqlite();
      TestDbMngr.metaKnex = knex(TestDbMngr.getMetaDbConfig());
      return;
    }

    TestDbMngr.metaKnex = knex(TestDbMngr.getDbConfigWithNoDb());
    await TestDbMngr.resetDatabase(TestDbMngr.metaKnex, TestDbMngr.dbName);
    await TestDbMngr.metaKnex.destroy();

    TestDbMngr.metaKnex = knex(TestDbMngr.getMetaDbConfig());
    await TestDbMngr.useDatabase(TestDbMngr.metaKnex, TestDbMngr.dbName);
  }

  static async setupSakila() {
    if (TestDbMngr.sakilaKnex) {
      await TestDbMngr.sakilaKnex.destroy();
    }

    if (TestDbMngr.isSqlite()) {
      await TestDbMngr.seedSakila();
      TestDbMngr.sakilaKnex = knex(TestDbMngr.getSakilaDbConfig());
      return;
    }

    TestDbMngr.sakilaKnex = knex(TestDbMngr.getDbConfigWithNoDb());
    await TestDbMngr.resetDatabase(
      TestDbMngr.sakilaKnex,
      TestDbMngr.sakilaDbName,
    );
    await TestDbMngr.sakilaKnex.destroy();

    TestDbMngr.sakilaKnex = knex(TestDbMngr.getSakilaDbConfig());
    await TestDbMngr.useDatabase(
      TestDbMngr.sakilaKnex,
      TestDbMngr.sakilaDbName,
    );
  }

  static async switchToSqlite() {
    // process.env[`DATABASE_URL`] = `sqlite3:///?database=${__dirname}/${TestDbMngr.dbName}.sqlite`;
    TestDbMngr.dbConfig = {
      client: 'sqlite3',
      connection: {
        filename: `${__dirname}/${TestDbMngr.dbName}.db`,
        database: TestDbMngr.dbName,
      },
      useNullAsDefault: true,
      meta: {
        tn: 'nc_evolutions',
        dbAlias: 'db',
        api: {
          type: 'rest',
          prefix: '',
          graphqlDepthLimit: 10,
        },
        inflection: {
          tn: 'camelize',
          cn: 'camelize',
        },
      },
    };

    process.env[
      `NC_DB`
    ] = `sqlite3:///?database=${__dirname}/${TestDbMngr.dbName}.db`;
    await TestDbMngr.setupMeta();
    await TestDbMngr.setupSakila();
  }

  private static async resetDatabase(knexClient, dbName) {
    if (TestDbMngr.isSqlite()) {
      // return knexClient.raw(`DELETE FROM sqlite_sequence`);
    } else {
      try {
        await knexClient.raw(`DROP DATABASE ${dbName}`);
      } catch (e) {}
      await knexClient.raw(`CREATE DATABASE ${dbName}`);
      console.log(`Database ${dbName} created`);

      if (!TestDbMngr.isPg()) {
        await knexClient.raw(`USE ${dbName}`);
      }
    }
  }

  static isSqlite() {
    return TestDbMngr.dbConfig.client === 'sqlite3';
  }

  static isPg() {
    return TestDbMngr.dbConfig.client === 'pg';
  }

  private static async useDatabase(knexClient, dbName) {
    if (!TestDbMngr.isSqlite() && !TestDbMngr.isPg()) {
      await knexClient.raw(`USE ${dbName}`);
    }
  }

  static getDbConfigWithNoDb() {
    const dbConfig = deepClone(TestDbMngr.dbConfig);
    dbConfig.connection.password = TestDbMngr.dbConfig.connection.password;
    delete dbConfig.connection.database;
    return dbConfig;
  }

  static getMetaDbConfig() {
    return TestDbMngr.dbConfig;
  }

  private static resetMetaSqlite() {
    if (fs.existsSync(`${__dirname}/test_meta.db`)) {
      fs.unlinkSync(`${__dirname}/test_meta.db`);
    }
  }

  static getSakilaDbConfig() {
    const sakilaDbConfig = JSON.parse(JSON.stringify(TestDbMngr.dbConfig));
    sakilaDbConfig.connection.database = TestDbMngr.sakilaDbName;
    sakilaDbConfig.connection.password =
      TestDbMngr.dbConfig.connection.password;
    sakilaDbConfig.connection.multipleStatements = true;
    if (TestDbMngr.isSqlite()) {
      sakilaDbConfig.connection.filename = `${__dirname}/test_sakila.db`;
    }
    return sakilaDbConfig;
  }

  // --- MSSQL data DB (pg meta + mssql data) --------------------------------
  // Enabled via NC_TEST_DATA_CLIENT=mssql. Connection from
  // NC_TEST_DATA_{HOST,PORT,USER,PASSWORD,DATABASE} with local defaults.
  // When enabled, NocoDB's internal/default (is_meta) source uses this DB via
  // NC_DATA_DB_JSON — so the standard table builders create tables in MSSQL
  // while meta stays on pg. Other dialects (pg/mysql/sqlite) leave NC_DATA_DB
  // unset, so their data DB == meta DB as before.

  static isMssqlDataDb() {
    return (process.env.NC_TEST_DATA_CLIENT || '').toLowerCase() === 'mssql';
  }

  static getMssqlDataDbConfig() {
    return {
      client: 'mssql',
      connection: {
        host: process.env.NC_TEST_DATA_HOST || 'localhost',
        port: Number(process.env.NC_TEST_DATA_PORT) || 1433,
        user: process.env.NC_TEST_DATA_USER || 'sa',
        password: process.env.NC_TEST_DATA_PASSWORD || 'Password123!',
        database: process.env.NC_TEST_DATA_DATABASE || TestDbMngr.dataDbName,
        options: { encrypt: false, trustServerCertificate: true },
      },
      searchPath: ['dbo'],
    };
  }

  // Drop + recreate the MSSQL data DB and point NocoDB at it via
  // NC_DATA_DB_JSON. Call once before server init.
  static async setupDataDb() {
    if (!TestDbMngr.isMssqlDataDb()) return;
    const cfg = TestDbMngr.getMssqlDataDbConfig();
    const dbName = cfg.connection.database;
    const adminKnex = knex({
      client: cfg.client,
      connection: { ...cfg.connection, database: 'master' },
      pool: { min: 0, max: 1 },
    });
    try {
      await adminKnex.raw(
        `IF DB_ID('${dbName}') IS NOT NULL BEGIN
           ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
           DROP DATABASE [${dbName}];
         END`,
      );
      await adminKnex.raw(`CREATE DATABASE [${dbName}]`);
    } finally {
      await adminKnex.destroy();
    }
    // EE NcConnectionMgrv2.getDataConfig() reads this for is_meta sources.
    process.env.NC_DATA_DB_JSON = JSON.stringify(cfg);
  }

  // Drop all FK constraints + tables in the MSSQL data DB (per-test reset).
  static async cleanupDataDb() {
    if (!TestDbMngr.isMssqlDataDb()) return;
    const cfg = TestDbMngr.getMssqlDataDbConfig();
    const dataKnex = knex({
      client: cfg.client,
      connection: cfg.connection,
      pool: { min: 0, max: 1 },
    });
    try {
      await dataKnex.raw(`
        DECLARE @sql NVARCHAR(MAX) = N'';
        SELECT @sql += 'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.'
          + QUOTENAME(OBJECT_NAME(parent_object_id)) + ' DROP CONSTRAINT '
          + QUOTENAME(name) + ';' FROM sys.foreign_keys;
        SELECT @sql += 'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + '.'
          + QUOTENAME(name) + ';' FROM sys.tables;
        IF LEN(@sql) > 0 EXEC sp_executesql @sql;
      `);
    } finally {
      await dataKnex.destroy();
    }
  }

  static async seedSakila() {
    const testsDir = __dirname.replace('tests/unit', 'tests');

    if (TestDbMngr.isSqlite()) {
      if (fs.existsSync(`${__dirname}/test_sakila.db`)) {
        fs.unlinkSync(`${__dirname}/test_sakila.db`);
      }
      fs.copyFileSync(
        `${testsDir}/sqlite-sakila-db/sakila.db`,
        `${__dirname}/test_sakila.db`,
      );
    } else if (TestDbMngr.isPg()) {
      const schemaFile = fs
        .readFileSync(`${testsDir}/pg-sakila-db/01-postgres-sakila-schema.sql`)
        .toString();
      const dataFile = fs
        .readFileSync(
          `${testsDir}/pg-sakila-db/02-postgres-sakila-insert-data.sql`,
        )
        .toString();
      await TestDbMngr.sakilaKnex.raw(schemaFile);
      await TestDbMngr.sakilaKnex.raw(dataFile);
    } else {
      const schemaFile = fs
        .readFileSync(`${testsDir}/mysql-sakila-db/03-test-sakila-schema.sql`)
        .toString();
      const dataFile = fs
        .readFileSync(`${testsDir}/mysql-sakila-db/04-test-sakila-data.sql`)
        .toString();
      await TestDbMngr.sakilaKnex.raw(schemaFile);
      await TestDbMngr.sakilaKnex.raw(dataFile);
    }
  }

  static async disableForeignKeyChecks(knexClient) {
    if (TestDbMngr.isSqlite()) {
      await knexClient.raw('PRAGMA foreign_keys = OFF');
    } else if (TestDbMngr.isPg()) {
      await knexClient.raw(`SET session_replication_role = 'replica'`);
    } else {
      await knexClient.raw(`SET FOREIGN_KEY_CHECKS = 0`);
    }
  }

  static async enableForeignKeyChecks(knexClient) {
    if (TestDbMngr.isSqlite()) {
      await knexClient.raw(`PRAGMA foreign_keys = ON;`);
    } else if (TestDbMngr.isPg()) {
      await knexClient.raw(`SET session_replication_role = 'origin'`);
    } else {
      await knexClient.raw(`SET FOREIGN_KEY_CHECKS = 1`);
    }
  }

  static async showAllTables(knexClient) {
    if (TestDbMngr.isSqlite()) {
      const tables = await knexClient.raw(
        `SELECT name FROM sqlite_master WHERE type='table'`,
      );
      return tables
        .filter((t) => t.name !== 'sqlite_sequence' && t.name !== '_evolutions')
        .map((t) => t.name);
    } else if (TestDbMngr.isPg()) {
      const tables = await knexClient.raw(
        `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';`,
      );
      return tables.rows.map((t) => t.tablename);
    } else {
      const response = await knexClient.raw(`SHOW TABLES`);
      return response[0].map((table) => Object.values(table)[0]);
    }
  }
}
