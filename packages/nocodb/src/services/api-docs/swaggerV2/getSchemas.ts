import { getModelSchemas } from './templates/schemas';
import type { Base, Model } from '~/models';

import type { SwaggerColumn } from './getSwaggerColumnMetas';
import type { SwaggerView } from './getSwaggerJSONV2';
import Noco from '~/Noco';

export default async function getSchemas(
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
    orgs: 'v1',
    baseName: base.title,
    columns,
  });

  return swaggerSchemas;
}
