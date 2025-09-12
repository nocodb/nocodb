import { getModelSchemas } from './templates/schemas';
import type { Base, Model } from '~/models';

import type { SwaggerColumn } from './getSwaggerColumnMetasV3';
import type { SwaggerView } from './getSwaggerJSONV3';
import Noco from '~/Noco';

export default async function getSchemasV3(
  {
    base,
    model,
    columns,
  }: {
    base: Base;
    model: Model;
    columns: SwaggerColumn[];
    views: SwaggerView[];
  },
  _ncMeta = Noco.ncMeta,
) {
  const swaggerSchemas = getModelSchemas({
    tableName: model.title,
    orgs: 'v3',
    baseName: base.title,
    columns,
  });

  return swaggerSchemas;
}
