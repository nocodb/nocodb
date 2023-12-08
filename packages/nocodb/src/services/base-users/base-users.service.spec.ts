import { Test } from '@nestjs/testing';
import { ProjectUsersService } from './base-users.service';
import type { TestingModule } from '@nestjs/testing';

describe('ProjectUsersService', () => {
  let service: ProjectUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectUsersService],
    }).compile();

    service = module.get<ProjectUsersService>(ProjectUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
