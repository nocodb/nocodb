import { getModelSchemas } from './templates/schemas';
import type { Base, Model, Source } from '~/models';

import type { SwaggerColumn } from './getSwaggerColumnMetas';
import type { SwaggerView } from './getSwaggerJSONV2';
import Noco from '~/Noco';

// Helper function to sanitize names for use in schema names
function sanitizeSchemaName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

export default async function getSchemas(
  context,
  {
    base,
    columns,
    tableName,
  }: {
    base: Base;
    model: Model;
    columns: SwaggerColumn[];
    views: SwaggerView[];
    sourcesMap: Map<string, Source>;
    tableName: string;
  },
  _ncMeta = Noco.ncMeta,
) {
  const swaggerSchemas = getModelSchemas({
    tableName,
    orgs: 'v1',
    baseName: base.title,
    columns,
  });

  return swaggerSchemas;
}
