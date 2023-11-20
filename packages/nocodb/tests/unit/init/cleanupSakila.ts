import { Audit, Base } from '../../../src/models'
import TestDbMngr from '../TestDbMngr';

const dropTablesOfSakila = async () => {
  await TestDbMngr.disableForeignKeyChecks(TestDbMngr.sakilaKnex);

  for (const tableName of sakilaTableNames) {
    try {
      if (TestDbMngr.isPg()) {
        await TestDbMngr.sakilaKnex.raw(
          `DROP TABLE IF EXISTS "${tableName}" CASCADE`
        );
      } else {
        await TestDbMngr.sakilaKnex.raw(`DROP TABLE ${tableName}`);
      }
    } catch (e) {}
  }
  await TestDbMngr.enableForeignKeyChecks(TestDbMngr.sakilaKnex);
};

const dropSchemaAndSeedSakila = async () => {
  try {
    await TestDbMngr.sakilaKnex.raw(`DROP SCHEMA "public" CASCADE`);
    await TestDbMngr.sakilaKnex.raw(`CREATE SCHEMA "public"`);
    await TestDbMngr.seedSakila();
  } catch (e) {
    console.error('dropSchemaAndSeedSakila', e);
    throw e;
  }
};

const resetAndSeedSakila = async () => {
  try {
    await dropTablesOfSakila();
    await TestDbMngr.seedSakila();
  } catch (e) {
    console.error('resetSakila', e);
    throw e;
  }
};

const cleanUpSakila = async (forceReset) => {
  try {
    const sakilaProject = await Base.getByTitle('sakila');

    const audits =
      sakilaProject && (await Audit.baseAuditList(sakilaProject.id, {}));

    if (audits?.length > 0 || forceReset) {
      // if PG, drop schema
      if (TestDbMngr.isPg()) {
        return await dropSchemaAndSeedSakila();
      }
      // if mysql, drop tables
      return await resetAndSeedSakila();
    }

    const tablesInSakila = await TestDbMngr.showAllTables(
      TestDbMngr.sakilaKnex
    );

    await Promise.all(
      tablesInSakila
        .filter((tableName) => !sakilaTableNames.includes(tableName))
        .map(async (tableName) => {
          try {
            if (TestDbMngr.isPg()) {
              await TestDbMngr.sakilaKnex.raw(
                `DROP TABLE "${tableName}" CASCADE`
              );
            } else {
              await TestDbMngr.sakilaKnex.raw(`DROP TABLE ${tableName}`);
            }
          } catch (e) {
            console.error(e);
          }
        })
    );
  } catch (e) {
    console.error('cleanUpSakila', e);
  }
};

const sakilaTableNames = [
  'actor',
  'address',
  'category',
  'city',
  'country',
  'customer',
  'film',
  'film_actor',
  'film_category',
  'inventory',
  'language',
  'payment',
  'payment_p2007_01',
  'payment_p2007_02',
  'payment_p2007_03',
  'payment_p2007_04',
  'payment_p2007_05',
  'payment_p2007_06',
  'rental',
  'staff',
  'store',
  'actor_info',
  'customer_list',
  'film_list',
  'nicer_but_slower_film_list',
  'sales_by_film_category',
  'sales_by_store',
  'staff_list',
];

export { cleanUpSakila, resetAndSeedSakila };
