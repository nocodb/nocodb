import { knownQueryParams } from '../lib/utils/NcConfigFactory';
import { DataRecoveryActivity, ServerIncident } from './entities';
import { addIncidentHandlingTables1689942863738 } from './migrations/1689942863738-addIncidentHandlingTables';

const ormConfig = () => {
  const url = new URL(process.env.NC_DB || '');

  const parsedQuery: any = {};
  for (const [key, value] of url.searchParams.entries()) {
    const fnd = knownQueryParams.find(
      (param) => param.parameter === key || param.aliases.includes(key)
    );
    if (fnd) {
      parsedQuery[fnd.parameter] = value;
    } else {
      parsedQuery[key] = value;
    }
  }

  const config = {
    type: 'postgres',
    host: url.hostname,
    port: +url.port,
    username: parsedQuery.user,
    password: parsedQuery.password,
    database: parsedQuery.database,
    entities: [ServerIncident, DataRecoveryActivity],
    migrations: [addIncidentHandlingTables1689942863738],
    migrationsRun: false,
    cli: {
      migrationsDir: `src/database/migrations`,
    },
    synchronize: false,
    dropSchema: false,
  };
  return config;
};

module.exports = ormConfig();
