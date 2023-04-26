import { InjectQueue } from '@nestjs/bull';
import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Queue } from 'bull';
import { GlobalGuard } from '../../../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../../middlewares/extract-project-id/extract-project-id.middleware';
import { ProjectsService } from '../../../services/projects.service';
import { Base, Project } from '../../../models';
import { generateUniqueName } from '../../../helpers/exportImportHelpers';
import { QueueService } from '../fallback-queue.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class DuplicateController {
  activeQueue;
  constructor(
    @InjectQueue('jobs') private readonly jobsQueue: Queue,
    private readonly fallbackQueueService: QueueService,
    private readonly projectsService: ProjectsService,
  ) {
    this.activeQueue = process.env.NC_REDIS_URL
      ? this.jobsQueue
      : this.fallbackQueueService;
  }

  @Post('/api/v1/db/meta/duplicate/:projectId/:baseId?')
  @HttpCode(200)
  @Acl('duplicateBase')
  async duplicateBase(
    @Request() req,
    @Param('projectId') projectId: string,
    @Param('baseId') baseId?: string,
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
      project: { title: uniqueTitle, status: 'job' },
      user: { id: req.user.id },
    });

    const job = await this.activeQueue.add('duplicate', {
      projectId: project.id,
      baseId: base.id,
      dupProjectId: dupProject.id,
      req: {
        user: req.user,
        clientIp: req.clientIp,
      },
    });

    return { id: job.id, name: job.name };
  }
}
