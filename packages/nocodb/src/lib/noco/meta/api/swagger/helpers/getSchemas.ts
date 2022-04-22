import Noco from '../../../../Noco';
import Model from '../../../../../noco-models/Model';
import Project from '../../../../../noco-models/Project';
import schemas from './templates/schemas';
import { SwaggerColumn } from './getSwaggerColumnMetas';

export default async function getSchemas(
  project: Project,
  model: Model,
  columns: SwaggerColumn[],
  _ncMeta = Noco.ncMeta
) {
  return schemas({
    tableName: model.title,
    orgs: 'noco',
    projectName: project.title,
    columns
  });
}
