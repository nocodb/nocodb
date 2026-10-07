import { ViewTypes } from 'nocodb-sdk';
import { generateSwagger } from '../shared/swaggerUtils';
import swaggerBase from './swagger-base-v3.json';
import getPathsV3 from './getPathsV3';
import getSchemasV3 from './getSchemasV3';
import getSwaggerColumnMetasV3 from './getSwaggerColumnMetasV3';
import type { SourcesMap } from '~/services/api-docs/types';
import type { Base, Model } from '~/models';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default async function getSwaggerJSONV3(
  context: NcContext,
  {
    base,
    sourcesMap,
    models,
  }: {
    base: Base;
    sourcesMap: SourcesMap;
    models: Model[];
  },
  ncMeta = Noco.ncMeta,
) {
  return generateSwagger(
    {
      context,
      base,
      models,
      sourcesMap,
      ncMeta,
      // The v3 data API lists and counts through any of these view types.
      viewTypes: [
        ViewTypes.GRID,
        ViewTypes.GALLERY,
        ViewTypes.KANBAN,
        ViewTypes.CALENDAR,
        ViewTypes.MAP,
      ],
    },
    swaggerBase,
    getSwaggerColumnMetasV3,
    getPathsV3,
    getSchemasV3,
    undefined,
    { skipMmSchemas: true },
  );
}
