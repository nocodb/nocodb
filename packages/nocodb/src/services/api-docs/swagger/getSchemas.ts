import { getModelSchemas, getViewSchemas } from './templates/schemas';
import type { Base, Model, Source } from '~/models';

import type { SwaggerColumn } from './getSwaggerColumnMetas';
import type { SwaggerView } from './getSwaggerJSON';
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
    views,
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

  for (const { view, columns: viewColumns } of views) {
    const swaggerColumns = columns.filter(
      (c) => viewColumns.find((vc) => vc.fk_column_id === c.column.id)?.show,
    );
    Object.assign(
      swaggerSchemas,
      getViewSchemas({
        tableName,
        viewName: sanitizeSchemaName(view.title),
        orgs: 'v1',
        columns: swaggerColumns,
        baseName: base.title,
      }),
    );
  }

  return swaggerSchemas;
}
