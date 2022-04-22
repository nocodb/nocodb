import Noco from '../../../../Noco';
import Model from '../../../../../noco-models/Model';
import Project from '../../../../../noco-models/Project';
import paths from './templates/paths';
import { SwaggerColumn } from './getSwaggerColumnMetas';
// import { ViewTypes } from 'nocodb-sdk';

export default async function getPaths(
  project: Project,
  model: Model,
  columns: SwaggerColumn[],
  _ncMeta = Noco.ncMeta
) {
  const swaggerPaths = await paths({
    tableName: model.title,
    type: model.type,
    orgs: 'noco',
    columns,
    projectName: project.title
  });

  // for (const view of (await model.getViews(false, ncMeta)) || []) {
  //   if (view.type !== ViewTypes.GRID) continue;
  //
  //   const gridColumns = await view.getColumns(ncMeta);
  //
  // }

  return swaggerPaths;
}
