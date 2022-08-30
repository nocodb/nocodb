import { dbConfig, dbName, sakilaDbName } from '../dbConfig';
import { Noco } from '../../../../lib';
import express from 'express';
import cleanupMeta from './cleanupMeta';
import cleanUpSakila from './cleanupSakila';
import { createUser } from '../tests/helpers/user';

const knex = require('knex');

const serverInit = async () => {
  const server = express();
  server.enable('trust proxy');
  server.use(await Noco.init());
  return server;
};

const resetDatabase = async (knexClient) => {
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

const cleanupAllTables = async (knexClient) => {
  const sakilaKnexClient = knex({
    client: 'mysql2',
    connection: {
      host: 'localhost',
      port: '3306',
      user: 'root',
      password: 'password',
      database: sakilaDbName,
    },
  });

  try {
    await cleanUpSakila(sakilaKnexClient);

    await sakilaKnexClient.destroy();

    await cleanupMeta(knexClient);
  } catch (e) {
    console.error('cleanupAllTables', e);
    sakilaKnexClient.destroy();
  }
};

export default async function () {
  const knexClient = knex(dbConfig);
  await resetDatabase(knexClient);

  const server = await serverInit();

  await cleanupAllTables(knexClient);

  await knexClient.destroy();

  const { token } = await createUser({ app: server }, { roles: 'editor' });

  return { app: server, token };
}
