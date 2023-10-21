import { getModelSchemas, getViewSchemas } from './templates/schemas';
import type { Base, Model } from '~/models';

import type { SwaggerColumn } from './getSwaggerColumnMetas';
import type { SwaggerView } from './getSwaggerJSON';
import Noco from '~/Noco';

export default async function getSchemas(
  {
    base,
    model,
    columns,
    views,
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

  for (const { view, columns: viewColumns } of views) {
    const swaggerColumns = columns.filter(
      (c) => viewColumns.find((vc) => vc.fk_column_id === c.column.id)?.show,
    );
    Object.assign(
      swaggerSchemas,
      getViewSchemas({
        tableName: model.title,
        viewName: view.title,
        orgs: 'v1',
        columns: swaggerColumns,
        baseName: base.title,
      }),
    );
  }

  return swaggerSchemas;
}
