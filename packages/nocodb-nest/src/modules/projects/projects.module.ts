import { Module } from '@nestjs/common';
import { ExtractProjectIdMiddleware } from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, ExtractProjectIdMiddleware],
})
export class ProjectsModule {}
