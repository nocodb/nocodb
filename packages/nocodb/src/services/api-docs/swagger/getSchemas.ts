import { getModelSchemas, getViewSchemas } from './templates/schemas';
import type { Base, Model, Source } from '~/models';

import type { SwaggerColumn } from './getSwaggerColumnMetas';
import type { SwaggerView } from '~/services/api-docs/shared/swaggerUtils';
import Noco from '~/Noco';

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
        viewName: view.title,
        orgs: 'v1',
        columns: swaggerColumns,
        baseName: base.title,
      }),
    );
  }

  return swaggerSchemas;
}
