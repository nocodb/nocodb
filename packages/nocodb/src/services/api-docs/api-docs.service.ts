import { Injectable } from '@nestjs/common';
import getSwaggerJSON from './swagger/getSwaggerJSON';
import getSwaggerJSONV2 from './swaggerV2/getSwaggerJSONV2';
import getSwaggerJSONV3 from './swaggerV3/getSwaggerJSONV3';
import type { NcContext } from '~/interface/config';
import type { Source } from '~/models';
import type { SourcesMap } from '~/services/api-docs/types';
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

    const models = await this.extractVisibleModels(context, param);
    const swagger = await getSwaggerJSON(context, {
      source: (await base.getSources())[0],
      base,
      models,
    });

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

    const models = await this.extractVisibleModels(context, param);
    const swagger = await getSwaggerJSONV2(context, {
      source: (await base.getSources())[0],
      base,
      models,
    });

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

  async swaggerJsonV3(
    context: NcContext,
    param: { baseId: string; siteUrl: string },
  ) {
    const base = await Base.get(context, param.baseId);

    if (!base) NcError.baseNotFound(param.baseId);

    const models = await Model.list(context, {
      base_id: param.baseId,
      source_id: null,
    });

    // Fetch sources once for the entire base to avoid repeated queries
    const sources = await base.getSources(false);
    const sourcesMap: SourcesMap = new Map<string, Source>(
      sources.map((source) => [source.id, source]),
    );
    const swagger = await getSwaggerJSONV3(context, {
      sourcesMap,
      base,
      models,
    });

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
