import { getModelPaths, getViewPaths } from './templates/paths';
import type { Base, Model } from '~/models';
import type { SwaggerColumn } from './getSwaggerColumnMetas';
import type { SwaggerView } from './getSwaggerJSON';
import Noco from '~/Noco';

export default async function getPaths(
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
  const swaggerPaths = await getModelPaths({
    tableName: model.title,
    type: model.type,
    orgs: 'v1',
    columns,
    baseName: base.id,
  });

  for (const { view, columns: viewColumns } of views) {
    const swaggerColumns = columns.filter(
      (c) => viewColumns.find((vc) => vc.fk_column_id === c.column.id)?.show,
    );
    Object.assign(
      swaggerPaths,
      await getViewPaths({
        tableName: model.title,
        viewName: view.title,
        type: model.type,
        orgs: 'v1',
        columns: swaggerColumns,
        baseName: base.id,
      }),
    );
  }

  return swaggerPaths;
}
