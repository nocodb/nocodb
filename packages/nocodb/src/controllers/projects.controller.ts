import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import isDocker from 'is-docker';
import { ProjectReqType } from 'nocodb-sdk';
import type { ProjectType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import Noco from '~/Noco';
import { packageVersion } from '~/utils/packageVersion';
import { ProjectsService } from '~/services/projects.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { Filter } from '~/models';

@UseGuards(GlobalGuard)
@Controller()
export class ProjectsController {
  constructor(protected readonly projectsService: ProjectsService) {}

  @Acl('projectList', {
    scope: 'org',
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

  @Acl('projectInfoGet')
  @Get('/api/v1/db/meta/projects/:projectId/info')
  async projectInfoGet() {
    return {
      Node: process.version,
      Arch: process.arch,
      Platform: process.platform,
      Docker: isDocker(),
      RootDB: Noco.getConfig()?.meta?.db?.client,
      PackageVersion: packageVersion,
    };
  }

  @Acl('projectGet')
  @Get('/api/v1/db/meta/projects/:projectId')
  async projectGet(@Param('projectId') projectId: string) {
    const project = await this.projectsService.getProjectWithInfo({
      projectId: projectId,
    });

    this.projectsService.sanitizeProject(project);

    return project;
  }

  @Acl('projectUpdate')
  @Patch('/api/v1/db/meta/projects/:projectId')
  async projectUpdate(
    @Param('projectId') projectId: string,
    @Body() body: Record<string, any>,
    @Request() req,
  ) {
    const project = await this.projectsService.projectUpdate({
      projectId,
      project: body,
      user: req.user,
    });

    return project;
  }

  @Acl('projectDelete')
  @Delete('/api/v1/db/meta/projects/:projectId')
  async projectDelete(@Param('projectId') projectId: string, @Request() req) {
    const deleted = await this.projectsService.projectSoftDelete({
      projectId,
      user: req.user,
    });

    return deleted;
  }

  @Acl('projectCreate', {
    scope: 'org',
  })
  @Post('/api/v1/db/meta/projects')
  @HttpCode(200)
  async projectCreate(@Body() projectBody: ProjectReqType, @Request() req) {
    const project = await this.projectsService.projectCreate({
      project: projectBody,
      user: req['user'],
    });

    return project;
  }

  @Acl('hasEmptyOrNullFilters')
  @Get('/api/v1/db/meta/projects/:projectId/has-empty-or-null-filters')
  async hasEmptyOrNullFilters(@Param('projectId') projectId: string) {
    return await Filter.hasEmptyOrNullFilters(projectId);
  }
}
