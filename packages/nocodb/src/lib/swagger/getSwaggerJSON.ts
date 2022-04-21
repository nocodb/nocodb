import Noco from '../noco/Noco';
import Model from '../noco-models/Model';
import swaggerBase from './swagger-base.json';
import getPaths from './getPaths';
import getSchemas from './getSchemas';
import Project from '../noco-models/Project';

export default async function getSwaggerJSON(
  project: Project,
  models: Model[],
  ncMeta = Noco.ncMeta
) {
  const swaggerObj = {
    ...swaggerBase,
    paths: {},
    components: {
      schemas: {}
    }
  };

  for (const model of models) {
    const paths = await getPaths(project, model, ncMeta);
    const schemas = await getSchemas(project, model, ncMeta);

    Object.assign(swaggerObj.paths, paths);
    Object.assign(swaggerObj.components.schemas, schemas);
  }

  return swaggerObj;
}
