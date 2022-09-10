import Audit from '../../../src/lib/models/Audit';
import Project from '../../../src/lib/models/Project';

import TestDbMngr from '../TestDbMngr';

const dropTablesOfSakila = async (sakilaKnexClient) => {
  await sakilaKnexClient.raw('SET FOREIGN_KEY_CHECKS = 0');
  try{
    for(const tableName of sakilaTableNames){
      await sakilaKnexClient.raw(`DROP TABLE ${tableName}`);
    }
  } catch (e) {
  }
  await sakilaKnexClient.raw('SET FOREIGN_KEY_CHECKS = 1');
}

const resetAndSeedSakila = async (sakilaKnexClient) => {
  try {
    await dropTablesOfSakila(sakilaKnexClient);
    
    await TestDbMngr.seedSakila(sakilaKnexClient);
    
    await sakilaKnexClient.raw(`USE ${TestDbMngr.sakilaDbName}`);
  } catch (e) {
    console.error('resetSakila', e);
    throw e
  }
}

const cleanUpSakila = async (sakilaKnexClient) => {
  try {
    const sakilaProject = await Project.getByTitle('sakila');

    const audits = sakilaProject && await Audit.projectAuditList(sakilaProject.id, {});

    if(audits?.length > 0) {
      return await resetAndSeedSakila(sakilaKnexClient);
    }

    const tablesInSakilaQueryRes = await sakilaKnexClient.raw(`SHOW TABLES;`);
    const tablesInSakila = tablesInSakilaQueryRes[0].map(
      (table) => Object.values(table)[0]
    );

    await Promise.all(
      tablesInSakila
        .filter((tableName) => !sakilaTableNames.includes(tableName))
        .map(async (tableName) => {
          try {
            await sakilaKnexClient.raw(`DROP TABLE ${tableName}`);
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
