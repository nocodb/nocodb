import { dbConfig, dbName, sakilaDbName } from '../dbConfig';

import express from 'express';
import cleanupMeta from './cleanupMeta';
import {cleanUpSakila, resetAndSeedSakila} from './cleanupSakila';
import { createUser } from '../tests/factory/user';
import knex from 'knex';
import Noco from '../../../../src/lib';

let server;
const knexClient = knex(dbConfig);
let sakilaKnexClient;

const serverInit = async () => {
  const serverInstance = express();
  serverInstance.enable('trust proxy');
  serverInstance.use(await Noco.init());
  return serverInstance;
};

const resetDatabase = async () => {
  try {
    if (!Noco.initialized) {
      try {
        await knexClient.raw(`DROP DATABASE ${dbName}`);
      } catch (e) {}
      await knexClient.raw(`CREATE DATABASE ${dbName}`);
    }
  } catch (e) {
    console.error('resetDatabase', e);
  }
};

const cleanupAllTables = async () => {
  try {
    await cleanUpSakila(sakilaKnexClient);

    await cleanupMeta(knexClient);
  } catch (e) {
    console.error('cleanupAllTables', e);
  }
};

const setupSakila = async () => {
  try {
    await knexClient.raw(`DROP DATABASE ${sakilaDbName}`);
  } catch(e) {
    console.log('setupSakila',e)
  }
  await knexClient.raw(`CREATE DATABASE ${sakilaDbName}`);
  await knexClient.raw(`USE ${dbName}`);

  sakilaKnexClient = knex({
    client: 'mysql2',
    connection: {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'password',
      database: sakilaDbName,
      multipleStatements: true,
    },
  });
  await sakilaKnexClient.raw(`USE ${sakilaDbName}`);
  await resetAndSeedSakila(sakilaKnexClient);
}

const isFirstTimeRun = () => !server

export default async function () {
  await knexClient.raw(`USE ${dbName}`);
  
  await resetDatabase();
  
  if (isFirstTimeRun()) {
    await setupSakila();
    server = await serverInit();
  }

  await cleanupAllTables();

  const { token } = await createUser({ app: server }, { roles: 'editor' });

  return { app: server, token, dbConfig };
}
