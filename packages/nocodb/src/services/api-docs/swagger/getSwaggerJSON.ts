import { generateSwagger } from '../shared/swaggerUtils';
import swaggerBase from './swagger-base.json';
import getPaths from './getPaths';
import getSchemas from './getSchemas';
import getSwaggerColumnMetas from './getSwaggerColumnMetas';
import type { Base, Model, Source } from '~/models';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default async function getSwaggerJSON(
  context: NcContext,
  {
    base,
    source,
    models,
  }: {
    base: Base;
    source: Source;
    models: Model[];
  },
  ncMeta = Noco.ncMeta,
) {
  return generateSwagger(
    { context, base, models, source, ncMeta },
    swaggerBase,
    getSwaggerColumnMetas,
    getPaths,
    getSchemas,
  );
}
