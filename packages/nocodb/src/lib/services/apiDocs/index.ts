import { NcError } from '../../meta/helpers/catchError';
import Model from '../../models/Model';
import Project from '../../models/Project';
import getSwaggerJSON from './getSwaggerJSON';

export async function swaggerJson(param: {
  projectId: string;
  siteUrl: string;
}) {
  const project = await Project.get(param.projectId);

  if (!project) NcError.notFound();

  const models = await Model.list({
    project_id: param.projectId,
    base_id: null,
  });

  const swagger = await getSwaggerJSON(project, models);

  swagger.servers = [
    {
      url: param.siteUrl,
    },
    {
      url: '{customUrl}',
      variables: {
        customUrl: {
          default: param.siteUrl,
          description: 'Provide custom nocodb app base url',
        },
      },
    },
  ] as any;

  return swagger;
}
