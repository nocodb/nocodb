import type { AggregationGeneratorParams } from '~/dbQueryClient/types';
import type { AggregationHandlerInterface } from '~/dbQueryClient/aggregations/aggregation-handler.interface';

/**
 * CE stub — Oracle aggregation support lives in the EE build
 * (`~/dbQueryClient/aggregations/handlers/oracle.handler` resolves to the EE
 * override there). In the CE build this throws, matching the CE
 * `OracleDBQueryClient` behaviour.
 */
export class OracleAggregationHandler implements AggregationHandlerInterface {
  generate(_params: AggregationGeneratorParams): string | undefined {
    throw new Error('Oracle is only available in the enterprise (EE) build');
  }
}
