import { Injectable } from '@nestjs/common';
import { BulkDataAliasService as BulkDataAliasServiceCE } from 'src/services/bulk-data-alias.service';
import type { NcApiVersion, NcRequest } from 'nocodb-sdk';
import type { PathParams } from '~/helpers/dataHelpers';
import type { NcContext } from '~/interface/config';
import { V1_V2_DATA_PAYLOAD_LIMIT } from '~/constants';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class BulkDataAliasService extends BulkDataAliasServiceCE {
  // todo: Integrate with filterArrJson bulkDataUpdateAll
  async bulkDataInsert(
    context: NcContext,
    param: PathParams & {
      body: any;
      cookie: NcRequest;
      chunkSize?: number;
      foreign_key_checks?: boolean;
      skip_hooks?: boolean;
      raw?: boolean;
      allowSystemColumn?: boolean;
      undo?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    // Only enforce limit for API token requests (not UI requests)
    if (
      param.cookie?.user?.is_api_token &&
      Array.isArray(param.body) &&
      param.body.length > V1_V2_DATA_PAYLOAD_LIMIT
    ) {
      NcError.get(context).maxInsertLimitExceeded(V1_V2_DATA_PAYLOAD_LIMIT);
    }

    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkInsert',
      options: [
        param.body,
        {
          cookie: param.cookie,
          foreign_key_checks: param.foreign_key_checks,
          skip_hooks: param.skip_hooks,
          raw: param.raw,
          allowSystemColumn: param.allowSystemColumn,
          typecast: (param.cookie?.query?.typecast ?? '') === 'true',
          undo: param.undo,
          apiVersion: param.apiVersion,
        },
      ],
    });
  }
}
