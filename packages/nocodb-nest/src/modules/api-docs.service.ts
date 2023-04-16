import { Injectable } from '@nestjs/common';
import { NcError } from '../helpers/catchError';
import { Model, Project } from '../models';
import getSwaggerJSON from './swagger/getSwaggerJSON';

@Injectable()
export class ApiDocsService {
  async swaggerJson(param: { projectId: string; siteUrl: string }) {
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
}
