import { getModelPaths } from './templates/paths';
import type { Model } from '~/models';
import type { SwaggerColumn } from './getSwaggerColumnMetas';
import type { SwaggerView } from './getSwaggerJSONV2';
import Noco from '~/Noco';

export default async function getPaths(
  {
    model,
    columns,
    views,
  }: {
    model: Model;
    columns: SwaggerColumn[];
    views: SwaggerView[];
  },
  _ncMeta = Noco.ncMeta,
) {
  const swaggerPaths = await getModelPaths({
    tableName: model.title,
    tableId: model.id,
    views,
    type: model.type,
    columns,
  });

  // for (const { view, columns: viewColumns } of views) {
  //   const swaggerColumns = columns.filter(
  //     (c) => viewColumns.find((vc) => vc.fk_column_id === c.column.id)?.show,
  //   );
  //   Object.assign(
  //     swaggerPaths,
  //     await getViewPaths({
  //       tableName: model.title,
  //       viewName: view.title,
  //       type: model.type,
  //       orgs: 'v1',
  //       columns: swaggerColumns,
  //       baseName: base.id,
  //     }),
  //   );
  // }

  return swaggerPaths;
}
