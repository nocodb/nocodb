import type { AggregationGeneratorParams } from '~/dbQueryClient/types';
import type { AggregationHandlerInterface } from '~/dbQueryClient/aggregations/aggregation-handler.interface';

/**
 * CE stub — MSSQL aggregation support lives in the EE build
 * (`~/dbQueryClient/aggregations/handlers/mssql.handler` resolves to the EE
 * override there). In the CE build this throws, matching the CE
 * `MssqlDBQueryClient` behaviour.
 */
export class MssqlAggregationHandler implements AggregationHandlerInterface {
  generate(_params: AggregationGeneratorParams): string | undefined {
    throw new Error('MSSQL is only available in the enterprise (EE) build');
  }
}
