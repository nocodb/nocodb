import Noco from '../../../../Noco';
import Model from '../../../../../noco-models/Model';
import Project from '../../../../../noco-models/Project';
import paths from './templates/paths';
import { SwaggerColumn } from './getSwaggerColumnMetas';

export default async function getPaths(
  project: Project,
  model: Model,
  columns: SwaggerColumn[],
  _ncMeta = Noco.ncMeta
) {
  return await paths({
    tableName: model.title,
    type: model.type,
    orgs: 'noco',
    columns,
    projectName: project.title
  });
}
