import { Injectable } from '@nestjs/common';
import getSwaggerJSON from './swagger/getSwaggerJSON';
import { NcError } from '~/helpers/catchError';
import { Base, Model } from '~/models';

@Injectable()
export class ApiDocsService {
  async swaggerJson(param: { baseId: string; siteUrl: string }) {
    const base = await Base.get(param.baseId);

    if (!base) NcError.notFound();

    const models = await Model.list({
      base_id: param.baseId,
      source_id: null,
    });

    const swagger = await getSwaggerJSON(base, models);

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
