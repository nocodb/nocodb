import { Test } from '@nestjs/testing';
import { OrgUsersService } from './org-users.service';
import type { TestingModule } from '@nestjs/testing';

describe('OrgUsersService', () => {
  let service: OrgUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrgUsersService],
    }).compile();

    service = module.get<OrgUsersService>(OrgUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
