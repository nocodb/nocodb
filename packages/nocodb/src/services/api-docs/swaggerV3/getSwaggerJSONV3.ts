import { ViewTypes } from 'nocodb-sdk';
import swaggerBase from './swagger-base-v3.json';
import getPathsV3 from './getPathsV3';
import getSchemasV3 from './getSchemasV3';
import getSwaggerColumnMetasV3 from './getSwaggerColumnMetasV3';
import type {
  Base,
  FormViewColumn,
  GalleryViewColumn,
  GridViewColumn,
  Model,
  View,
} from '~/models';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';

export default async function getSwaggerJSONV3(
  context: NcContext,
  base: Base,
  models: Model[],
  ncMeta = Noco.ncMeta,
) {
  // base swagger object
  const swaggerObj = {
    ...swaggerBase,
    paths: {},
    components: {
      ...swaggerBase.components,
      schemas: { ...swaggerBase.components.schemas },
    },
  };

  // iterate and populate swagger schema and path for models and views
  for (const model of models) {
    let paths = {};

    const columns = await getSwaggerColumnMetasV3(
      context,
      await model.getColumns(context, ncMeta),
      base,
      ncMeta,
    );

    const views: SwaggerView[] = [];

    for (const view of (await model.getViews(context, false, ncMeta)) || []) {
      if (view.type !== ViewTypes.GRID) continue;
      views.push({
        view,
        columns: await view.getColumns(context, ncMeta),
      });
    }

    // skip mm tables
    if (!model.mm)
      paths = await getPathsV3(
        context,
        { base, model, columns, views },
        ncMeta,
      );

    const schemas = await getSchemasV3({ base, model, columns, views }, ncMeta);

    Object.assign(swaggerObj.paths, paths);
    Object.assign(swaggerObj.components.schemas, schemas);
  }

  return swaggerObj;
}

export interface SwaggerView {
  view: View;
  columns: Array<GridViewColumn | GalleryViewColumn | FormViewColumn>;
}
