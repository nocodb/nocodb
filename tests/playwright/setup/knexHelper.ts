import { knex, Knex } from 'knex';
import { promises as fs } from 'fs';
import path from 'path';
import { getKnexConfig } from '../tests/utils/config';

// ── MSSQL Sakila ────────────────────────────────────────────────────────────
// MSSQL has no fast `CREATE DATABASE ... TEMPLATE` like pg, and the data file is
// ~46k single-row INSERTs (≈95s if autocommitted). Strategy mirroring pg's
// template approach but tuned for MSSQL:
//   • Build the worker's Sakila DB ONCE (schema GO-split + data in ONE
//     transaction with SET NOCOUNT ON → ~10s instead of ~95s), then BACKUP it.
//   • Per-test reset = RESTORE from that backup (~0.7s) — full isolation, cheap.
// Backup/data files live inside the MSSQL container's data dir; SQL Server (not
// this host process) reads/writes them via BACKUP/RESTORE T-SQL.
const MSSQL_DATA_DIR = '/var/opt/mssql/data';
// Per-worker-process flag: each Playwright worker is its own Node process, so a
// module-level set persists for that worker's lifetime — build once, restore after.
const mssqlSakilaBuilt = new Set<string>();

function stripSakilaDbStatements(sql: string): string {
  // The fixture hardcodes `CREATE DATABASE sakila;` / `USE sakila;` — drop them
  // so we load into our own per-worker DB via the connection's `database`.
  return sql
    .split(/\r?\n/)
    .filter(l => !/^\s*CREATE\s+DATABASE\s+sakila\b/i.test(l) && !/^\s*USE\s+sakila\b/i.test(l))
    .join('\n');
}

async function initializeSakilaMssql(database: string) {
  const testsDir = __dirname.replace('/tests/playwright/setup', '/packages/nocodb/tests');
  const sakilaDir = `${testsDir}/sql-server-sakila-db`;

  // (re)create the target DB from master
  {
    const kn = knex(getKnexConfig({ dbName: 'master', dbType: 'mssql' }));
    await kn.raw(
      `IF DB_ID('${database}') IS NOT NULL BEGIN ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${database}]; END`
    );
    await kn.raw(`CREATE DATABASE [${database}]`);
    await kn.destroy();
  }

  const kn = knex(getKnexConfig({ dbName: database, dbType: 'mssql' }));
  try {
    // schema: T-SQL `GO` batch separators must be split (tedious can't parse GO)
    const schema = stripSakilaDbStatements(
      (await fs.readFile(`${sakilaDir}/01-sql-server-sakila-schema.sql`)).toString()
    );
    for (const batch of schema
      .split(/^\s*GO\s*$/im)
      .map(b => b.trim())
      .filter(Boolean)) {
      await kn.raw(batch);
    }

    // data: ~46k single-row INSERTs — one transaction + SET NOCOUNT ON (≈10s vs ≈95s)
    const data = stripSakilaDbStatements(
      (await fs.readFile(`${sakilaDir}/02-sql-server-sakila-insert-data.sql`)).toString()
    );
    const trx = await kn.transaction();
    try {
      await trx.raw('SET NOCOUNT ON;');
      await trx.raw(data);
      await trx.commit();
    } catch (e) {
      await trx.rollback();
      throw e;
    }
  } finally {
    await kn.destroy();
  }
}

export async function resetSakilaMssql(database: string) {
  const bak = path.posix.join(MSSQL_DATA_DIR, `${database}.bak`);
  const kn = knex(getKnexConfig({ dbName: 'master', dbType: 'mssql' }));
  try {
    if (!mssqlSakilaBuilt.has(database)) {
      // First use in this worker: full load (~10s) then back it up. The freshly
      // built DB is already clean, so no restore is needed on this first call.
      await kn.destroy();
      await initializeSakilaMssql(database);
      const kn2 = knex(getKnexConfig({ dbName: 'master', dbType: 'mssql' }));
      try {
        await kn2.raw(`BACKUP DATABASE [${database}] TO DISK = N'${bak}' WITH INIT, FORMAT, COMPRESSION`);
      } finally {
        await kn2.destroy();
      }
      mssqlSakilaBuilt.add(database);
      return;
    }

    // Subsequent resets: restore over the live DB (kill open connections first).
    // Logical file names are `${database}` / `${database}_log` because the DB
    // was created via `CREATE DATABASE [${database}]`.
    await kn.raw(`ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE`);
    await kn.raw(
      `RESTORE DATABASE [${database}] FROM DISK = N'${bak}' WITH REPLACE, ` +
        `MOVE N'${database}' TO N'${path.posix.join(MSSQL_DATA_DIR, `${database}.mdf`)}', ` +
        `MOVE N'${database}_log' TO N'${path.posix.join(MSSQL_DATA_DIR, `${database}_log.ldf`)}'`
    );
    await kn.raw(`ALTER DATABASE [${database}] SET MULTI_USER`);
  } finally {
    await kn.destroy().catch(() => {});
  }
}

async function dropAndCreateDb(kn: Knex, dbName: string, dbType: string) {
  if (dbType === 'pg') {
    await kn.raw(`DROP DATABASE IF EXISTS ?? WITH (FORCE)`, [dbName]);
  } else {
    await kn.raw(`DROP DATABASE IF EXISTS ??`, [dbName]);
  }
  await kn.raw(`CREATE DATABASE ??`, [dbName]);
}

export async function initializeSakilaPg(database: string) {
  {
    const kn = knex(getKnexConfig({ dbName: 'postgres', dbType: 'pg' }));

    await dropAndCreateDb(kn, database, 'pg');

    await kn.destroy();
  }

  {
    const kn = knex(getKnexConfig({ dbName: database, dbType: 'pg' }));

    const testsDir = __dirname.replace('/tests/playwright/setup', '/packages/nocodb/tests');
    const schemaFile = await fs.readFile(`${testsDir}/pg-sakila-db/01-postgres-sakila-schema.sql`);
    await kn.raw(schemaFile.toString());

    const trx = await kn.transaction();
    const dataFile = await fs.readFile(`${testsDir}/pg-sakila-db/02-postgres-sakila-insert-data.sql`);
    await trx.raw(dataFile.toString());
    await trx.commit();

    await kn.destroy();
  }
}

export async function resetSakilaPg(database: string) {
  const kn = knex(getKnexConfig({ dbName: 'postgres', dbType: 'pg' }));

  try {
    // Wait for backend connections to drain before dropping the database.
    // DROP DATABASE WITH (FORCE) kills active connections, which can leave
    // the backend's connection pool in a broken state or trigger uncaught
    // errors that crash the process (process.exit(1) in handleUncaughtErrors).
    for (let i = 0; i < 20; i++) {
      const result = await kn.raw(
        `SELECT count(*)::int AS cnt FROM pg_stat_activity WHERE datname = ? AND pid != pg_backend_pid()`,
        [database]
      );
      if (result.rows[0].cnt === 0) break;
      if (i === 0) {
        console.log(`resetSakilaPg(${database}): waiting for ${result.rows[0].cnt} connection(s) to close...`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await kn.raw(`DROP DATABASE IF EXISTS ?? WITH (FORCE)`, [database]);

    // Fast path: use pre-built template (created by CI workflow step)
    const templateExists = await kn.raw(`SELECT 1 FROM pg_database WHERE datname = 'sakila_template'`);

    if (templateExists.rows.length > 0) {
      await kn.raw(`CREATE DATABASE ?? TEMPLATE sakila_template`, [database]);
      await kn.destroy();
      return;
    }

    await kn.destroy();

    // Slow path (local dev): full schema + data import
    await initializeSakilaPg(database);
  } catch (e) {
    await kn.destroy().catch(() => {});
    throw e;
  }
}

export async function createTableWithDateTimeColumn(database: string, dbName: string, setTz = false) {
  if (database === 'pg') {
    {
      const pgknex = knex(getKnexConfig({ dbName: 'postgres', dbType: 'pg' }));
      await dropAndCreateDb(pgknex, dbName, 'pg');
      await pgknex.destroy();
    }

    {
      const pgknex = knex(getKnexConfig({ dbName, dbType: 'pg' }));
      try {
        await pgknex.raw(`
          CREATE TABLE my_table (
            title serial PRIMARY KEY,
            datetime_without_tz TIMESTAMP WITHOUT TIME ZONE,
            datetime_with_tz TIMESTAMP WITH TIME ZONE
          );
          -- SET timezone = 'Asia/Hong_Kong';
          -- SELECT pg_sleep(1);
          INSERT INTO my_table (datetime_without_tz, datetime_with_tz)
          VALUES
            ('2023-04-27 10:00:00', '2023-04-27 10:00:00'),
            ('2023-04-27 10:00:00+05:30', '2023-04-27 10:00:00+05:30');
        `);
      } catch (e) {
        console.error(`Error resetting pg sakila db: Worker ${dbName}`);
      }
      await pgknex.destroy();
    }
  } else if (database === 'mysql') {
    {
      const mysqlknex = knex(getKnexConfig({ dbName: 'sakila', dbType: 'mysql' }));

      await dropAndCreateDb(mysqlknex, dbName, 'mysql');

      if (setTz) {
        await mysqlknex.raw(`SET GLOBAL time_zone = '+08:00'`);
        // wait for 1 second for the timezone to be set
        await mysqlknex.raw(`SELECT SLEEP(1)`);
      }

      await mysqlknex.destroy();
    }

    {
      const mysqlknex = knex(getKnexConfig({ dbName, dbType: 'mysql' }));

      try {
        await mysqlknex.raw(`
          CREATE TABLE my_table (
            title INT AUTO_INCREMENT PRIMARY KEY,
            datetime_without_tz DATETIME,
            datetime_with_tz TIMESTAMP
          );
          INSERT INTO my_table (datetime_without_tz, datetime_with_tz)
          VALUES
            ('2023-04-27 10:00:00', '2023-04-27 10:00:00'),
            ('2023-04-27 10:00:00+05:30', '2023-04-27 10:00:00+05:30');
        `);
      } catch (e) {
        console.error(`Error resetting mysql sakila db: Worker ${dbName}`);
      }

      await mysqlknex.destroy();
    }
  } else if (database === 'sqlite') {
    const sqliteknex = knex(getKnexConfig({ dbName, dbType: 'sqlite' }));
    try {
      await sqliteknex.raw(`DROP TABLE IF EXISTS my_table`);
      await sqliteknex.raw(`
        CREATE TABLE my_table (
          title INTEGER PRIMARY KEY AUTOINCREMENT,
          datetime_without_tz DATETIME,
          datetime_with_tz DATETIME )`);
      const datetimeData = [
        ['2023-04-27 10:00:00', '2023-04-27 10:00:00'],
        ['2023-04-27 10:00:00+05:30', '2023-04-27 10:00:00+05:30'],
      ];
      for (const [datetime_without_tz, datetime_with_tz] of datetimeData) {
        await sqliteknex.raw(
          `
          INSERT INTO my_table (datetime_without_tz, datetime_with_tz)
          VALUES (?, ?)`,
          [datetime_without_tz, datetime_with_tz]
        );
      }
    } catch (e) {
      console.error(`Error resetting sqlite sakila db: Worker ${dbName}`);
    }

    await sqliteknex.destroy();
  }
}

export async function mysqlTz() {
  const mysqlknex = knex(getKnexConfig({ dbName: 'sakila', dbType: 'mysql' }));
  await mysqlknex.raw(`SET GLOBAL time_zone = '+00:00'`);
  await mysqlknex.destroy();
}
