import { createConnection } from 'typeorm';
import type { Connection } from 'typeorm';

const ormConfig = require('./database/ormConfig');

export const createDatabaseConnection = async (): Promise<Connection> => {
  return createConnection(ormConfig);
};

export const connectionWrapper = async () => {
  createDatabaseConnection();
};
