import Noco from '../../../Noco';
import Model from '../../../models/Model';
import Project from '../../../models/Project';
import { getModelSchemas, getViewSchemas } from './templates/schemas';
import { SwaggerColumn } from './getSwaggerColumnMetas';
import { SwaggerView } from './getSwaggerJSON';

export default async function getSchemas(
  {
    project,
    model,
    columns,
    views,
  }: {
    project: Project;
    model: Model;
    columns: SwaggerColumn[];
    views: SwaggerView[];
  },
  _ncMeta = Noco.ncMeta
) {
  const swaggerSchemas = getModelSchemas({
    tableName: model.title,
    orgs: 'v1',
    projectName: project.title,
    columns,
  });

  for (const { view, columns: viewColumns } of views) {
    const swaggerColumns = columns.filter(
      (c) => viewColumns.find((vc) => vc.fk_column_id === c.column.id)?.show
    );
    Object.assign(
      swaggerSchemas,
      getViewSchemas({
        tableName: model.title,
        viewName: view.title,
        orgs: 'v1',
        columns: swaggerColumns,
        projectName: project.title,
      })
    );
  }

  return swaggerSchemas;
}
