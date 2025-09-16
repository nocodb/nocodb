import { getModelPaths } from './templates/paths';
import type { Base, Model } from '~/models';
import type { SwaggerColumn } from './getSwaggerColumnMetasV3';
import type { SwaggerView } from './getSwaggerJSONV3';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default async function getPathsV3(
  context: NcContext,
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
  const swaggerPaths = await getModelPaths(context, {
    baseId: base.id,
    tableName: model.title,
    tableId: model.id,
    views,
    type: model.type,
    columns,
  });

  return swaggerPaths;
}
