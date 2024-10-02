import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import PgConnectionConfig = Knex.PgConnectionConfig;
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import CustomKnex from '~/db/CustomKnex';
const logger = new Logger('initBaseBehavior');

export async function initBaseBehavior() {
  const dataConfig = await NcConnectionMgrv2.getDataConfig();

  // return if client is not postgres
  if (dataConfig.client !== 'pg') {
    return;
  }

  // disable minimal databases feature if NC_DISABLE_BASE_AS_PG_SCHEMA is set to true
  if(process.env.NC_DISABLE_BASE_AS_PG_SCHEMA === 'true') {
    process.env.NC_MINIMAL_DBS = 'false';
    return;
  }

  // if NC_MINIMAL_DBS already exists, return
  if (process.env.NC_MINIMAL_DBS === 'false') {
    return;
  }

  let tempConnection: Knex<any, unknown[]> | undefined;

  try {
    tempConnection = CustomKnex(dataConfig);

    // check if database user have permission to create new schema
    const schemaCreateAllowed = await tempConnection.raw(
      "SELECT has_database_privilege(:user, :database, 'CREATE') as has_database_privilege",
      {
        database: (dataConfig.connection as PgConnectionConfig).database,
        user: (dataConfig.connection as PgConnectionConfig).user,
      },
    );

    // if schema creation is not allowed, return
    if (!schemaCreateAllowed.rows[0]?.has_database_privilege) {
      // set NC_MINIMAL_DBS to false if it's set to true and log warning
      if (process.env.NC_MINIMAL_DBS === 'true') {
        process.env.NC_MINIMAL_DBS = 'false';
      }
      logger.warn(
        `User ${(dataConfig.connection as PgConnectionConfig)?.user} does not have permission to create schema, minimal databases feature will be disabled`,
      );
      return;
    }

    // set NC_MINIMAL_DBS to true
    process.env.NC_MINIMAL_DBS = 'true';
  } catch (error) {
    logger.warn(
      `Error while checking schema creation permission: ${error.message}`,
    );
  } finally {
    // close the connection since it's only used to verify permission
    await tempConnection?.destroy();
  }
}
