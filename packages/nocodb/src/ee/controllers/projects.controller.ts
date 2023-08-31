import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ProjectsController as ProjectsControllerCE } from 'src/controllers/projects.controller';
import { PagedResponseImpl } from 'src/helpers/PagedResponse';
import { ProjectReqType } from 'nocodb-sdk';
import type { ProjectType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ProjectsService } from '~/services/projects.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@UseGuards(GlobalGuard)
@Controller()
export class ProjectsController extends ProjectsControllerCE {
  constructor(protected readonly projectsService: ProjectsService) {
    super(projectsService);
  }

  @Acl('projectList', {
    scope: 'workspace',
  })
  @Get('/api/v1/db/meta/projects/')
  async list(@Query() queryParams: Record<string, any>, @Request() req) {
    const projects = await this.projectsService.projectList({
      user: req.user,
      query: queryParams,
    });
    return new PagedResponseImpl(projects as ProjectType[], {
      count: projects.length,
      limit: projects.length,
    });
  }

  @Acl('projectCreate', {
    scope: 'workspace',
  })
  @Post('/api/v1/db/meta/projects')
  @HttpCode(200)
  @Acl('projectCreate')
  async projectCreate(@Body() projectBody: ProjectReqType, @Request() req) {
    const project = await this.projectsService.projectCreate({
      project: projectBody,
      user: req['user'],
    });

    return project;
  }
}
