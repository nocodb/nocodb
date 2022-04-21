import Noco from '../noco/Noco';
import Model from '../noco-models/Model';
import Project from '../noco-models/Project';
import schemas from './templates/schemas';

export default async function getSchemas(
  project: Project,
  model: Model,
  _ncMeta = Noco.ncMeta
) {
  return schemas({
    tableName: model.title,
    orgs: 'noco',
    projectName: project.title,
    columns: []
  });
}
