import { Controller, UseGuards } from '@nestjs/common';
import { ProjectsController as ProjectsControllerCE } from 'src/controllers/projects.controller';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ProjectsService } from '~/services/projects.service';

@UseGuards(GlobalGuard)
@Controller()
export class ProjectsController extends ProjectsControllerCE {
  constructor(protected readonly projectsService: ProjectsService) {
    super(projectsService);
  }
}
