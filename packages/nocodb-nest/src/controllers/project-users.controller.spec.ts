import { Test } from '@nestjs/testing';
import { ProjectUsersController } from './project-users.controller';
import { ProjectUsersService } from '../services/project-users/project-users.service';
import type { TestingModule } from '@nestjs/testing';

describe('ProjectUsersController', () => {
  let controller: ProjectUsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectUsersController],
      providers: [ProjectUsersService],
    }).compile();

    controller = module.get<ProjectUsersController>(ProjectUsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
