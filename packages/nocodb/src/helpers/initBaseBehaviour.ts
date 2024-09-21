import { Logger } from '@nestjs/common';
import { Knex } from 'knex';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/ee/utils/common/NcConnectionMgrv2';
import CustomKnex from '~/db/CustomKnex';
import PgConnectionConfig = Knex.PgConnectionConfig;
const logger = new Logger('initBaseBehavior');

export async function initBaseBehavior() {
  const dataConfig = await NcConnectionMgrv2.getDataConfig();

  // return if client is not postgres
  if (dataConfig.client !== 'pg') {
    return;
  }

  // if NC_MINIMAL_DBS already exists, return
  if (process.env.NC_MINIMAL_DBS) {
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
    if (!schemaCreateAllowed.rows[0].has_database_privilege) {
      return;
    }

    // set NC_MINIMAL_DBS to true
    process.env.NC_MINIMAL_DBS = 'true';
  } catch {
    logger.warn('Error while checking schema creation permission');
  } finally {
    // close the connection since it's only used to verify permission
    await tempConnection?.destroy();
  }
}
