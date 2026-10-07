import { getModelPaths } from './templates/paths';
import type { Base, Model, Source } from '~/models';
import type { SwaggerColumn } from './getSwaggerColumnMetasV3';
import type { SwaggerView } from '~/services/api-docs/shared/swaggerUtils';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default async function getPathsV3(
  context: NcContext,
  {
    base,
    model,
    columns,
    views,
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
  const swaggerPaths = await getModelPaths(context, {
    baseId: base.id,
    tableName,
    schemaName,
    tableId: model.id,
    views,
    type: model.type,
    columns,
  });

  return swaggerPaths;
}
