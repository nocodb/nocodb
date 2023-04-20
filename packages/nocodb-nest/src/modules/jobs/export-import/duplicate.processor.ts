import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Base, Project } from 'src/models';
import { Job } from 'bull';
import { ProjectsService } from 'src/services/projects.service';
import boxen from 'boxen';
import { generateUniqueName } from 'src/helpers/exportImportHelpers';
import { ExportService } from './export.service';
import { ImportService } from './import.service';

@Processor('duplicate')
export class DuplicateProcessor {
  constructor(
    private exportService: ExportService,
    private importService: ImportService,
    private projectsService: ProjectsService,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    console.log(
      `Processing job ${job.id} of type ${job.name} with data ${job.data}...`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    console.error(
      boxen(
        `---- !! JOB FAILED !! ----\ntype: ${job.name}\nid:${job.id}\nerror:${error.name} (${error.message})\n\nstack: ${error.stack}`,
        {
          padding: 1,
          borderStyle: 'double',
          borderColor: 'yellow',
        },
      ),
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    console.log(`Completed job ${job.id} of type ${job.name}!`);
  }

  @Process('duplicate')
  async duplicateBase(job: Job) {
    const param: { projectId: string; baseId?: string; req: any } = job.data;

    const user = (param.req as any).user;

    const project = await Project.get(param.projectId);

    if (!project) {
      throw new Error(`Base not found for id '${param.baseId}'`);
    }

    const base = param?.baseId
      ? await Base.get(param.baseId)
      : (await project.getBases())[0];

    if (!base) {
      throw new Error(`Base not found!`);
    }

    const exported = await this.exportService.exportBase({
      path: `${job.name}_${job.id}`,
      baseId: base.id,
    });

    if (!exported) {
      throw new Error(`Export failed for base '${base.id}'`);
    }

    const projects = await Project.list({});

    const uniqueTitle = generateUniqueName(
      `${project.title} copy`,
      projects.map((p) => p.title),
    );

    const dupProject = await this.projectsService.projectCreate({
      project: { title: uniqueTitle },
      user: { id: user.id },
    });

    await this.importService.importBase({
      user,
      projectId: dupProject.id,
      baseId: dupProject.bases[0].id,
      src: {
        type: 'local',
        path: exported.path,
      },
      req: param.req,
    });
  }
}
