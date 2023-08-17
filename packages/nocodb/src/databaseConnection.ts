import { createConnection, MigrationExecutor } from 'typeorm';
import type { Connection } from 'typeorm';

const ormConfig = require('./database/ormConfig');

export const createDatabaseConnection = async (): Promise<Connection> => {
  return createConnection(ormConfig);
};

export const connectionWrapper = async () => {
  createDatabaseConnection();
};

export const runMigrations = async (connection: Connection) => {
  console.log('Checking for migrations...');

  const pendingMigrations = await new MigrationExecutor(
    connection,
    connection.createQueryRunner('master')
  ).getPendingMigrations();

  if (pendingMigrations.length) {
    console.log('Starting migrations...');

    try {
      await new MigrationExecutor(
        connection,
        connection.createQueryRunner('master')
      ).executePendingMigrations();

      console.log('Migrations Executed!');
    } catch (err) {
      throw new Error(`Migration failed with error: ${err}`);
    }
  }

  console.log('Completed Migration Check');
};
