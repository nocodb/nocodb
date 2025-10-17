import { generateSwagger } from '../shared/swaggerUtils';
import swaggerBase from './swagger-base-v3.json';
import getPathsV3 from './getPathsV3';
import getSchemasV3 from './getSchemasV3';
import getSwaggerColumnMetasV3 from './getSwaggerColumnMetasV3';
import type { Base, Model } from '~/models';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default async function getSwaggerJSONV3(
  context: NcContext,
  base: Base,
  models: Model[],
  ncMeta = Noco.ncMeta,
) {
  return generateSwagger(
    { context, base, models, ncMeta },
    swaggerBase,
    getSwaggerColumnMetasV3,
    getPathsV3,
    getSchemasV3,
  );
}
