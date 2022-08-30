import { sakilaTableNames } from '../dbConfig';

const cleanUpSakila = async (sakilaKnexClient) => {
  try {
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

export default cleanUpSakila;
