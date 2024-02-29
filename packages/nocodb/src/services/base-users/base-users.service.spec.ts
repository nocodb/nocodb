import { Test } from '@nestjs/testing';
import { BaseUsersService } from './base-users.service';
import type { TestingModule } from '@nestjs/testing';

describe('BaseUsersService', () => {
  let service: BaseUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BaseUsersService],
    }).compile();

    service = module.get<BaseUsersService>(BaseUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
