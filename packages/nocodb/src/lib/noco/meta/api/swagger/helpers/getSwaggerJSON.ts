import Noco from '../../../../Noco';
import Model from '../../../../../noco-models/Model';
import swaggerBase from './swagger-base.json';
import getPaths from './getPaths';
import getSchemas from './getSchemas';
import Project from '../../../../../noco-models/Project';
import getSwaggerColumnMetas from './getSwaggerColumnMetas';

export default async function getSwaggerJSON(
  project: Project,
  models: Model[],
  ncMeta = Noco.ncMeta
) {
  const swaggerObj = {
    ...swaggerBase,
    paths: {},
    components: {
      schemas: { ...swaggerBase.components.schemas }
    }
  };

  for (const model of models) {
    let paths = {};

    const columns = await getSwaggerColumnMetas(
      await model.getColumns(ncMeta),
      project,
      ncMeta
    );

    // skip mm tables
    if (!model.mm) paths = await getPaths(project, model, columns, ncMeta);
    const schemas = await getSchemas(project, model, columns, ncMeta);

    Object.assign(swaggerObj.paths, paths);
    Object.assign(swaggerObj.components.schemas, schemas);
  }

  return swaggerObj;
}
