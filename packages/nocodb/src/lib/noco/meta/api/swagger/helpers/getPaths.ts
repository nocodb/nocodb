import Noco from '../../../../Noco';
import Model from '../../../../../noco-models/Model';
import Project from '../../../../../noco-models/Project';
import { getModelPaths, getViewPaths } from './templates/paths';
import { SwaggerColumn } from './getSwaggerColumnMetas';
import { SwaggerView } from './getSwaggerJSON';

export default async function getPaths(
  {
    project,
    model,
    columns,
    views
  }: {
    project: Project;
    model: Model;
    columns: SwaggerColumn[];
    views: SwaggerView[];
  },
  _ncMeta = Noco.ncMeta
) {
  const swaggerPaths = await getModelPaths({
    tableName: model.title,
    type: model.type,
    orgs: 'noco',
    columns,
    projectName: project.title
  });

  for (const { view, columns: viewColumns } of views) {
    const swaggerColumns = columns.filter(
      c => viewColumns.find(vc => vc.fk_column_id === c.column.id)?.show
    );
    Object.assign(
      swaggerPaths,
      await getViewPaths({
        tableName: model.title,
        viewName: view.title,
        type: model.type,
        orgs: 'noco',
        columns: swaggerColumns,
        projectName: project.title
      })
    );
  }

  return swaggerPaths;
}
