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
import { GlobalGuard } from '../guards/global/global.guard';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import {
  ExtractProjectIdMiddleware,
  UseAclMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import Noco from '../Noco';
import { packageVersion } from '../utils/packageVersion';
import { ProjectsService } from '../services/projects.service';
import type { ProjectType } from 'nocodb-sdk';

@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @UseAclMiddleware({
    permissionName: 'projectList',
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

  @Get('/api/v1/db/meta/projects/:projectId')
  async projectGet(@Param('projectId') projectId: string) {
    const project = await this.projectsService.getProjectWithInfo({
      projectId: projectId,
    });

    this.projectsService.sanitizeProject(project);

    return project;
  }

  @Patch('/api/v1/db/meta/projects/:projectId')
  async projectUpdate(
    @Param('projectId') projectId: string,
    @Body() body: Record<string, any>,
    @Request() req,
  ) {
    const project = await this.projectsService.projectUpdate({
      projectId,
      project: body,
      user: req['user'],
    });

    return project;
  }

  @Delete('/api/v1/db/meta/projects/:projectId')
  async projectDelete(@Param('projectId') projectId: string, @Request() req) {
    const deleted = await this.projectsService.projectSoftDelete({
      projectId,
      user: req['user'],
    });

    return deleted;
  }

  @Post('/api/v1/db/meta/projects')
  @HttpCode(200)
  async projectCreate(@Body() projectBody: ProjectReqType, @Request() req) {
    const project = await this.projectsService.projectCreate({
      project: projectBody,
      user: req['user'],
    });

    return project;
  }
}
