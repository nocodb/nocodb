import { Test } from '@nestjs/testing';
import { OrgUsersService } from '../services/org-users.service';
import { OrgUsersController } from './org-users.controller';
import type { TestingModule } from '@nestjs/testing';

describe('OrgUsersController', () => {
  let controller: OrgUsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrgUsersController],
      providers: [OrgUsersService],
    }).compile();

    controller = module.get<OrgUsersController>(OrgUsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
