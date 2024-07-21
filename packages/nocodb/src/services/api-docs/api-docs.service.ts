import { Injectable } from '@nestjs/common';
import getSwaggerJSON from './swagger/getSwaggerJSON';
import getSwaggerJSONV2 from './swaggerV2/getSwaggerJSONV2';
import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Base, Model } from '~/models';

@Injectable()
export class ApiDocsService {
  async swaggerJson(
    context: NcContext,
    param: { baseId: string; siteUrl: string },
  ) {
    const base = await Base.get(context, param.baseId);

    if (!base) NcError.baseNotFound(param.baseId);

    const models = await Model.list(context, {
      base_id: param.baseId,
      source_id: null,
    });

    const swagger = await getSwaggerJSON(context, base, models);

    swagger.servers = [
      {
        url: param.siteUrl,
      },
      {
        url: '{customUrl}',
        variables: {
          customUrl: {
            default: param.siteUrl,
            description: 'Provide custom nocodb app base url',
          },
        },
      },
    ] as any;

    return swagger;
  }
  async swaggerJsonV2(
    context: NcContext,
    param: { baseId: string; siteUrl: string },
  ) {
    const base = await Base.get(context, param.baseId);

    if (!base) NcError.baseNotFound(param.baseId);

    const models = await Model.list(context, {
      base_id: param.baseId,
      source_id: null,
    });

    const swagger = await getSwaggerJSONV2(context, base, models);

    swagger.servers = [
      {
        url: param.siteUrl,
      },
      {
        url: '{customUrl}',
        variables: {
          customUrl: {
            default: param.siteUrl,
            description: 'Provide custom nocodb app base url',
          },
        },
      },
    ] as any;

    return swagger;
  }
}
