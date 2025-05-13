import { Injectable } from '@nestjs/common';
import { BulkDataAliasService as BulkDataAliasServiceCE } from 'src/services/bulk-data-alias.service';
import type { NcApiVersion, NcRequest } from 'nocodb-sdk';
import type { PathParams } from '~/helpers/dataHelpers';
import type { NcContext } from '~/interface/config';

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
