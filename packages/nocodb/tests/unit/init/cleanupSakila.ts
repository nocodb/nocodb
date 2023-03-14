import Audit from '../../../src/lib/models/Audit';
import Project from '../../../src/lib/models/Project';
import TestDbMngr from '../TestDbMngr';

const dropTablesOfSakila = async () => {
  await TestDbMngr.disableForeignKeyChecks(TestDbMngr.sakilaKnex);

  for(const tableName of sakilaTableNames){
    try {
      await TestDbMngr.sakilaKnex.raw(`DROP TABLE ${tableName}`);
    } catch(e){}
  }
  await TestDbMngr.enableForeignKeyChecks(TestDbMngr.sakilaKnex);
}

const resetAndSeedSakila = async () => {
  try {
    await dropTablesOfSakila();
    await TestDbMngr.seedSakila();
  } catch (e) {
    console.error('resetSakila', e);
    throw e
  }
}

const cleanUpSakila = async () => {
  try {
    const sakilaProject = await Project.getByTitle('sakila');

    const audits = sakilaProject && await Audit.projectAuditList(sakilaProject.id, {});

    if(audits?.length > 0) {
      return await resetAndSeedSakila();
    }

    const tablesInSakila = await TestDbMngr.showAllTables(TestDbMngr.sakilaKnex);

    await Promise.all(
      tablesInSakila
        .filter((tableName) => !sakilaTableNames.includes(tableName))
        .map(async (tableName) => {
          try {
            await TestDbMngr.sakilaKnex.raw(`DROP TABLE ${tableName}`);
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
  'film_text',
  'inventory',
  'language',
  'payment',
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
