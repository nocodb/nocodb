import { Controller, UseGuards } from '@nestjs/common';
import { ProjectsController as ProjectsControllerCE } from 'src/controllers/projects.controller';
import { ExtractIdsMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ProjectsService } from '~/services/projects.service';

@UseGuards(ExtractIdsMiddleware, GlobalGuard)
@Controller()
export class ProjectsController extends ProjectsControllerCE {
  constructor(protected readonly projectsService: ProjectsService) {
    super(projectsService);
  }
}
