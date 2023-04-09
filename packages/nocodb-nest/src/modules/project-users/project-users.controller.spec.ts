import { Test, TestingModule } from '@nestjs/testing';
import { ProjectUsersController } from './project-users.controller';
import { ProjectUsersService } from './project-users.service';

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
