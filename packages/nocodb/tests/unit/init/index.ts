
import express from 'express';
import knex from 'knex';
import { Noco } from '../../../src/lib';

import cleanupMeta from './cleanupMeta';
import {cleanUpSakila, resetAndSeedSakila} from './cleanupSakila';
import { createUser } from '../factory/user';
import TestDbMngr from '../TestDbMngr';

let server;
let knexClient;
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
        await knexClient.raw(`DROP DATABASE ${TestDbMngr.dbName}`);
      } catch (e) {}
      await knexClient.raw(`CREATE DATABASE ${TestDbMngr.dbName}`);
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
    await knexClient.raw(`DROP DATABASE ${TestDbMngr.sakilaDbName}`);
  } catch(e) {
    console.log('setupSakila',e)
  }
  await knexClient.raw(`CREATE DATABASE ${TestDbMngr.sakilaDbName}`);
  await knexClient.raw(`USE ${TestDbMngr.dbName}`);

  sakilaKnexClient = knex(TestDbMngr.getSakilaDbConfig());
  await sakilaKnexClient.raw(`USE ${TestDbMngr.sakilaDbName}`);
  await resetAndSeedSakila(sakilaKnexClient);
}

const isFirstTimeRun = () => !server

export default async function () {
  if(!knexClient) {
    knexClient = knex(TestDbMngr.dbConfig);
  }
  await knexClient.raw(`USE ${TestDbMngr.dbName}`);
  
  await resetDatabase();
  
  if (isFirstTimeRun()) {
    await setupSakila();
    server = await serverInit();
  }

  await cleanupAllTables();

  const { token } = await createUser({ app: server }, { roles: 'editor' });

  return { app: server, token, dbConfig: TestDbMngr.dbConfig };
}
