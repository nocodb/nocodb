import { ClientType } from 'nocodb-sdk';
import type { AggregationHandlerInterface } from '~/dbQueryClient/aggregations/aggregation-handler.interface';
import { PgAggregationHandler } from '~/dbQueryClient/aggregations/handlers/pg.handler';
import { MysqlAggregationHandler } from '~/dbQueryClient/aggregations/handlers/mysql.handler';
import { SqliteAggregationHandler } from '~/dbQueryClient/aggregations/handlers/sqlite.handler';
// mssql / oracle resolve to the EE overrides in the EE build (CE stubs throw).
import { MssqlAggregationHandler } from '~/dbQueryClient/aggregations/handlers/mssql.handler';
import { OracleAggregationHandler } from '~/dbQueryClient/aggregations/handlers/oracle.handler';

/**
 * Per-dialect aggregation strategy registry — the aggregation analogue of the
 * `field-handler` `HANDLER_REGISTRY`. Maps a database client to the handler
 * class that builds its aggregation SQL.
 */
const AGGREGATION_HANDLER_REGISTRY: Partial<
  Record<ClientType, new () => AggregationHandlerInterface>
> = {
  [ClientType.PG]: PgAggregationHandler,
  [ClientType.MYSQL]: MysqlAggregationHandler,
  [ClientType.SQLITE]: SqliteAggregationHandler,
  [ClientType.MSSQL]: MssqlAggregationHandler,
  [ClientType.ORACLE]: OracleAggregationHandler,
};

/**
 * Resolve the aggregation handler for a database client.
 * @throws when the dialect has no registered handler.
 */
export function getAggregationHandler(
  clientType: ClientType,
): AggregationHandlerInterface {
  const HandlerClass = AGGREGATION_HANDLER_REGISTRY[clientType];
  if (!HandlerClass) {
    throw new Error(
      `No aggregation handler registered for client '${clientType}'`,
    );
  }
  return new HandlerClass();
}

export { AGGREGATION_HANDLER_REGISTRY };
