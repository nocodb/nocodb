import { Noco } from '../../../lib';
import express from 'express';
import { dbConfig, dbName } from './dbConfig';

const knex = require('knex');

export default async function () {
  try {
    await knex(dbConfig).raw(`DROP DATABASE ${dbName}`);
    await knex(dbConfig).raw(`CREATE DATABASE ${dbName}`);
  } catch {}

  const server = express();
  server.enable('trust proxy');
  server.use(await Noco.forceInit());

  return server;
}
