import { Noco } from '../../../lib';
import express from 'express';
import { dbConfig, dbName, sakilaDbName, sakilaTableNames } from './dbConfig';
import { orderedMetaTables } from '../../../lib/utils/globals';

const knex = require('knex');

const clearAllMetaTables = async (knexClient) => {
  await knexClient.raw(`use ${sakilaDbName}`);
  const tablesInSakilaQueryRes = await knexClient.raw(`SHOW TABLES;`);
  const tablesInSakila = tablesInSakilaQueryRes[0].map(
    (table) => Object.values(table)[0]
  );

  await Promise.all(
    tablesInSakila
      .filter((tableName) => !sakilaTableNames.includes(tableName))
      .map(async (tableName) => {
        try {
          await knexClient.raw(`DROP TABLE ${sakilaDbName}.${tableName}`);
        } catch (e) {
          console.error(e);
        }
      })
  );

  await knexClient.raw(`use ${dbName}`);
  await knexClient.raw('SET FOREIGN_KEY_CHECKS = 0');
  for (const tableName of orderedMetaTables) {
    try {
      await knexClient.raw(`DELETE FROM ${tableName}`);
    } catch (e) {}
  }
  await knexClient.raw('SET FOREIGN_KEY_CHECKS = 1');
};

export default async function () {
  const knexClient = knex(dbConfig);
  try {
    if (!Noco.initialized) {
      try {
        await knexClient.raw(`DROP DATABASE ${dbName}`);
      } catch (e) {}
      await knexClient.raw(`CREATE DATABASE ${dbName}`);
    }
  } catch (e) {
    console.error(e);
  }

  const server = express();
  server.enable('trust proxy');
  server.use(await Noco.init());

  await clearAllMetaTables(knexClient);
  await knexClient.destroy();
  return server;
}
