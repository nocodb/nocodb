import { SSLUsage } from 'nocodb-sdk';
import { buildSqlAuthSsl, sslModeFromConfig } from 'nocodb-sdk';
import type { KnexSqlSslValue, SqlSslConfig } from 'nocodb-sdk';

// The SSL mode vocabulary and its knex mapping live in the SDK so that the DB
// auth integrations and the built-in "Database" data-source form resolve a
// mode the same way. They used to carry separate implementations that
// disagreed about `Preferred`: this one did not verify the server, the form
// did.
export { SSLUsage, buildSqlAuthSsl, sslModeFromConfig };
export type { KnexSqlSslValue };

/** @deprecated use `SqlSslConfig` from `nocodb-sdk`. */
export type SqlAuthSslConfig = SqlSslConfig;
