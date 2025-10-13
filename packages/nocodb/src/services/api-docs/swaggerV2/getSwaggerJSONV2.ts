import { generateSwagger } from '../shared/swaggerUtils';
import swaggerBase from './swagger-base.json';
import getPaths from './getPaths';
import getSchemas from './getSchemas';
import getSwaggerColumnMetas from './getSwaggerColumnMetas';
import type { Base, Model } from '~/models';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default async function getSwaggerJSONV2(
  context: NcContext,
  base: Base,
  models: Model[],
  ncMeta = Noco.ncMeta,
) {
  return generateSwagger(
    { context, base, models, ncMeta },
    swaggerBase,
    getSwaggerColumnMetas,
    getPaths,
    getSchemas,
  );
}
