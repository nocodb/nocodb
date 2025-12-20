import { Injectable } from '@nestjs/common';
import type { NcApiVersion, NcRequest } from 'nocodb-sdk';
import type { PathParams } from '~/helpers/dataHelpers';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { NcContext } from '~/interface/config';
import { V1_V2_DATA_PAYLOAD_LIMIT } from '~/constants';
import { getViewAndModelByAliasOrId } from '~/helpers/dataHelpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';

type BulkOperation =
  | 'bulkInsert'
  | 'bulkUpdate'
  | 'bulkUpdateAll'
  | 'bulkDelete'
  | 'bulkUpsert'
  | 'bulkDeleteAll';

@Injectable()
export class BulkDataAliasService {
  async getModelViewBase(context: NcContext, param: PathParams) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    const source = await Source.get(context, model.source_id);
    return { model, view, source };
  }

  async executeBulkOperation<T extends BulkOperation>(
    context: NcContext,
    param: PathParams & {
      operation: T;
      options: Parameters<(typeof BaseModelSqlv2.prototype)[T]>;
    },
  ) {
    const { model, view, source } = await this.getModelViewBase(context, param);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });
    return await baseModel[param.operation].apply(null, param.options);
  }

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
    },
  ) {
    // Only enforce limit for API token requests (not UI requests)
    if (
      param.cookie?.user?.is_api_token &&
      Array.isArray(param.body) &&
      param.body.length > V1_V2_DATA_PAYLOAD_LIMIT
    ) {
      NcError.get(context).maxPayloadLimitExceeded(V1_V2_DATA_PAYLOAD_LIMIT);
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
          undo: param.undo,
        },
      ],
    });
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  async bulkDataUpdate(
    context: NcContext,
    param: PathParams & {
      body: any;
      cookie: NcRequest;
      raw?: boolean;
      allowSystemColumn?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    // Only enforce limit for API token requests (not UI requests)
    if (
      param.cookie?.user?.is_api_token &&
      Array.isArray(param.body) &&
      param.body.length > V1_V2_DATA_PAYLOAD_LIMIT
    ) {
      NcError.get(context).maxPayloadLimitExceeded(V1_V2_DATA_PAYLOAD_LIMIT);
    }

    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkUpdate',
      options: [
        param.body,
        {
          cookie: param.cookie,
          raw: param.raw,
          allowSystemColumn: param.allowSystemColumn,
          apiVersion: param.apiVersion,
        },
      ],
    });
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  async bulkDataUpdateAll(
    context: NcContext,
    param: PathParams & {
      body: any;
      cookie: NcRequest;
      query: any;
      internalFlags?: {
        skipHooks?: boolean;
      };
    },
  ) {
    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkUpdateAll',
      options: [
        param.query,
        param.body,
        { cookie: param.cookie, skip_hooks: param.internalFlags?.skipHooks },
      ],
    });
  }

  async bulkDataDelete(
    context: NcContext,
    param: PathParams & {
      body: any;
      cookie: NcRequest;
    },
  ) {
    // Only enforce limit for API token requests (not UI requests)
    if (
      param.cookie?.user?.is_api_token &&
      Array.isArray(param.body) &&
      param.body.length > V1_V2_DATA_PAYLOAD_LIMIT
    ) {
      NcError.get(context).maxPayloadLimitExceeded(V1_V2_DATA_PAYLOAD_LIMIT);
    }

    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkDelete',
      options: [param.body, { cookie: param.cookie }],
    });
  }

  // todo: Integrate with filterArrJson bulkDataDeleteAll
  async bulkDataDeleteAll(
    context: NcContext,
    param: PathParams & {
      query: any;
      req: NcRequest;
      internalFlags?: {
        skipHooks?: boolean;
      };
    },
  ) {
    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkDeleteAll',
      options: [
        param.query,
        { cookie: param.req, skip_hooks: param.internalFlags?.skipHooks },
      ],
    });
  }

  async bulkDataUpsert(
    context: NcContext,
    param: PathParams & {
      body: any;
      cookie: NcRequest;
      undo: boolean;
    },
  ) {
    // Only enforce limit for API token requests (not UI requests)
    if (
      param.cookie?.user?.is_api_token &&
      Array.isArray(param.body) &&
      param.body.length > V1_V2_DATA_PAYLOAD_LIMIT
    ) {
      NcError.get(context).maxPayloadLimitExceeded(V1_V2_DATA_PAYLOAD_LIMIT);
    }

    return await this.executeBulkOperation(context, {
      ...param,
      operation: 'bulkUpsert',
      options: [param.body, { cookie: param.cookie, undo: param.undo }],
    });
  }
}
