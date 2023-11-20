import { knex, Knex } from 'knex';
import { promises as fs } from 'fs';
import { getKnexConfig } from '../tests/utils/config';

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
  try {
    await initializeSakilaPg(database);
  } catch (e) {
    console.error(`Error resetting pg sakila db: Worker ${database}`, e);
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
