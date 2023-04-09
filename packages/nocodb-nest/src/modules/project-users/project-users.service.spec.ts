import { Test, TestingModule } from '@nestjs/testing';
import { ProjectUsersService } from './project-users.service';

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
