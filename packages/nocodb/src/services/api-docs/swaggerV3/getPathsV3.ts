import { getModelPaths } from './templates/paths';
import type { Model } from '~/models';
import type { SwaggerColumn } from './getSwaggerColumnMetasV3';
import type { SwaggerView } from './getSwaggerJSONV3';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default async function getPathsV3(
  context: NcContext,
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
  const swaggerPaths = await getModelPaths(context, {
    tableName: model.title,
    tableId: model.id,
    views,
    type: model.type,
    columns,
  });

  return swaggerPaths;
}
