import Audit from '../../../src/lib/models/Audit';
import Project from '../../../src/lib/models/Project';
import { dbPassword, dbUser, sakilaTableNames, sakilaDbName } from '../dbConfig';
import { exec } from 'child_process';

async function sh(cmd) {
  return new Promise(function (resolve, reject) {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

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
    
    const testsDir = __dirname.replace('tests/unit/init', 'tests');
    await sh(`echo "SOURCE ${testsDir}/mysql-sakila-db/03-test-sakila-schema.sql" | mysql -u ${dbUser} -p${dbPassword} ${sakilaDbName}`);
    await sh(`echo "SOURCE ${testsDir}/mysql-sakila-db/04-test-sakila-data.sql" | mysql -u ${dbUser} -p${dbPassword} ${sakilaDbName}`);
    
    await sakilaKnexClient.raw(`USE ${sakilaDbName}`);
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

export { cleanUpSakila, resetAndSeedSakila };
