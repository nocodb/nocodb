import { Test } from '@nestjs/testing';
import { ProjectsService } from '../services/projects.service';
import { ProjectsController } from './projects.controller';
import type { TestingModule } from '@nestjs/testing';

describe('ProjectsController', () => {
  let controller: ProjectsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [ProjectsService],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
