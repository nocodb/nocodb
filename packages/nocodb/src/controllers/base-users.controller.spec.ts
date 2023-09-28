import { Test } from '@nestjs/testing';
import { ProjectUsersService } from '../services/base-users/base-users.service';
import { ProjectUsersController } from './base-users.controller';
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
