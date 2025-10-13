import { getModelPaths } from './templates/paths';
import type { Model, Source } from '~/models';
import type { SwaggerColumn } from './getSwaggerColumnMetas';
import type { SwaggerView } from './getSwaggerJSONV2';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default async function getPaths(
  context: NcContext,
  {
    model,
    columns,
    views,
    sourcesMap,
    tableName,
  }: {
    model: Model;
    columns: SwaggerColumn[];
    views: SwaggerView[];
    sourcesMap: Map<string, Source>;
    tableName: string;
  },
  _ncMeta = Noco.ncMeta,
) {
  const swaggerPaths = await getModelPaths(context, {
    tableName,
    tableId: model.id,
    views,
    type: model.type,
    columns,
  });

  return swaggerPaths;
}
