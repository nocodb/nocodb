import { getModelSchemas } from './templates/schemas';
import type { Base, Model, Source } from '~/models';

import type { SwaggerColumn } from './getSwaggerColumnMetasV3';
import type { SwaggerView } from '~/services/api-docs/shared/swaggerUtils';
import Noco from '~/Noco';

export default async function getSchemasV3(
  context,
  {
    base,
    columns,
    tableName,
    schemaName,
  }: {
    base: Base;
    model: Model;
    columns: SwaggerColumn[];
    views: SwaggerView[];
    sourcesMap: Map<string, Source>;
    tableName: string;
    schemaName: string;
  },
  _ncMeta = Noco.ncMeta,
) {
  const swaggerSchemas = getModelSchemas({
    tableName,
    schemaName,
    orgs: 'v3',
    baseName: base.title,
    columns,
  });

  return swaggerSchemas;
}
