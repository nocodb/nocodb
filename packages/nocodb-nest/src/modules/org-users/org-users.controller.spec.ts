import { Test, TestingModule } from '@nestjs/testing';
import { OrgUsersController } from './org-users.controller';
import { OrgUsersService } from './org-users.service';

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
