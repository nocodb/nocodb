import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import PgConnectionConfig = Knex.PgConnectionConfig;
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import CustomKnex from '~/db/CustomKnex';
import { SqlClientFactory } from '~/db/sql-client/lib/SqlClientFactory';
const logger = new Logger('initBaseBehavior');

async function isSchemaCreateAllowed(
  tempConnection: Knex<any, unknown[]>,
  dataConfig: any,
  skipDatabaseCreation = false,
) {
  try {
    // check if database user have permission to create new schema
    return await tempConnection.raw(
      "SELECT has_database_privilege(:user, :database, 'CREATE') as has_database_privilege",
      {
        database: (dataConfig.connection as PgConnectionConfig).database,
        user: (dataConfig.connection as PgConnectionConfig).user,
      },
    );
  } catch (e) {
    // check if error is due to database not found
    if (e.message.includes('does not exist') && !skipDatabaseCreation) {
      // create sqlClient from dataConfig
      const sqlClient = SqlClientFactory.create({
        ...dataConfig,
        knex: tempConnection,
      });

      // create database if it doesn't exist
      await sqlClient.createDatabaseIfNotExists({
        database: dataConfig.connection.database,
        schema: dataConfig.searchPath?.[0] || 'public',
      });
      return isSchemaCreateAllowed(tempConnection, dataConfig, true);
    }
    throw e;
  }
}

export async function initBaseBehavior() {
  const dataConfig = await NcConnectionMgrv2.getDataConfig();

  // return if client is not postgres
  if (dataConfig.client !== 'pg') {
    return;
  }

  // disable minimal databases feature if NC_DISABLE_PG_DATA_REFLECTION is set to true
  if (process.env.NC_DISABLE_PG_DATA_REFLECTION === 'true') {
    return;
  }

  let tempConnection: Knex<any, unknown[]> | undefined;

  try {
    tempConnection = CustomKnex(dataConfig);
    const schemaCreateAllowed = await isSchemaCreateAllowed(
      tempConnection,
      dataConfig,
    );

    // if schema creation is not allowed, return
    if (!schemaCreateAllowed?.rows?.[0]?.has_database_privilege) {
      // set NC_DISABLE_PG_DATA_REFLECTION to true and log warning
      process.env.NC_DISABLE_PG_DATA_REFLECTION = 'true';
      logger.warn(
        `User ${
          (dataConfig.connection as PgConnectionConfig)?.user
        } does not have permission to create schema, minimal databases feature will be disabled`,
      );
      return;
    }

    // set NC_DISABLE_PG_DATA_REFLECTION to false
    process.env.NC_DISABLE_PG_DATA_REFLECTION = 'false';
  } catch (error) {
    logger.warn(
      `Error while checking schema creation permission: ${error.message}`,
    );
    process.env.NC_DISABLE_PG_DATA_REFLECTION = 'true';
  } finally {
    // close the connection since it's only used to verify permission
    await tempConnection?.destroy();
  }
}
