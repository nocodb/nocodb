import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ProjectStatus } from 'nocodb-sdk';
import { GlobalGuard } from '../../../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../../middlewares/extract-project-id/extract-project-id.middleware';
import { ProjectsService } from '../../../services/projects.service';
import { Base, Model, Project } from '../../../models';
import { generateUniqueName } from '../../../helpers/exportImportHelpers';
import { JobsService } from '../jobs.service';
import { JobTypes } from '../../../interface/Jobs';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class DuplicateController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly projectsService: ProjectsService,
  ) {}

  @Post('/api/v1/db/meta/duplicate/:projectId/:baseId?')
  @HttpCode(200)
  @Acl('duplicateBase')
  async duplicateBase(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('baseId') baseId?: string,
    @Body()
    options?: {
      excludeData?: boolean;
      excludeViews?: boolean;
      excludeHooks?: boolean;
    },
  ) {
    const project = await Project.get(projectId);

    if (!project) {
      throw new Error(`Project not found for id '${projectId}'`);
    }

    const base = baseId
      ? await Base.get(baseId)
      : (await project.getBases())[0];

    if (!base) {
      throw new Error(`Base not found!`);
    }

    const projects = await Project.list({});

    const uniqueTitle = generateUniqueName(
      `${project.title} copy`,
      projects.map((p) => p.title),
    );

    const dupProject = await this.projectsService.projectCreate({
      project: { title: uniqueTitle, status: ProjectStatus.JOB },
      user: { id: req.user.id },
    });

    const job = await this.jobsService.activeQueue.add(JobTypes.DuplicateBase, {
      projectId: project.id,
      baseId: base.id,
      dupProjectId: dupProject.id,
      options,
      req: {
        user: req.user,
        clientIp: req.clientIp,
      },
    });

    return { id: job.id, name: job.name };
  }

  @Post('/api/v1/db/meta/duplicate/:projectId/table/:modelId')
  @HttpCode(200)
  @Acl('duplicateModel')
  async duplicateModel(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('modelId') modelId?: string,
    @Body()
    options?: {
      excludeData?: boolean;
      excludeViews?: boolean;
      excludeHooks?: boolean;
    },
  ) {
    const project = await Project.get(projectId);

    if (!project) {
      throw new Error(`Project not found for id '${projectId}'`);
    }

    const model = await Model.get(modelId);

    if (!model) {
      throw new Error(`Model not found!`);
    }

    const base = await Base.get(model.base_id);

    const models = await base.getModels();

    const uniqueTitle = generateUniqueName(
      `${model.title} copy`,
      models.map((p) => p.title),
    );

    const job = await this.jobsService.activeQueue.add(
      JobTypes.DuplicateModel,
      {
        projectId: project.id,
        baseId: base.id,
        modelId: model.id,
        title: uniqueTitle,
        options,
        req: {
          user: req.user,
          clientIp: req.clientIp,
        },
      },
    );

    return { id: job.id, name: job.name };
  }
}
