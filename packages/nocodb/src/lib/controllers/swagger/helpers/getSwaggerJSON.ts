import FormViewColumn from '../../../models/FormViewColumn';
import GalleryViewColumn from '../../../models/GalleryViewColumn';
import Noco from '../../../Noco';
import Model from '../../../models/Model';
import swaggerBase from './swagger-base.json';
import getPaths from './getPaths';
import getSchemas from './getSchemas';
import Project from '../../../models/Project';
import getSwaggerColumnMetas from './getSwaggerColumnMetas';
import { ViewTypes } from 'nocodb-sdk';
import GridViewColumn from '../../../models/GridViewColumn';
import View from '../../../models/View';

export default async function getSwaggerJSON(
  project: Project,
  models: Model[],
  ncMeta = Noco.ncMeta
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

    const columns = await getSwaggerColumnMetas(
      await model.getColumns(ncMeta),
      project,
      ncMeta
    );

    const views: SwaggerView[] = [];

    for (const view of (await model.getViews(false, ncMeta)) || []) {
      if (view.type !== ViewTypes.GRID) continue;
      views.push({
        view,
        columns: await view.getColumns(ncMeta),
      });
    }

    // skip mm tables
    if (!model.mm)
      paths = await getPaths({ project, model, columns, views }, ncMeta);

    const schemas = await getSchemas(
      { project, model, columns, views },
      ncMeta
    );

    Object.assign(swaggerObj.paths, paths);
    Object.assign(swaggerObj.components.schemas, schemas);
  }

  return swaggerObj;
}

export interface SwaggerView {
  view: View;
  columns: Array<GridViewColumn | GalleryViewColumn | FormViewColumn>;
}
