import { Test } from '@nestjs/testing';
import { BaseUsersController } from './base-users.controller';
import type { TestingModule } from '@nestjs/testing';
import { BaseUsersService } from '~/services/base-users/base-users.service';

describe('BaseUsersController', () => {
  let controller: BaseUsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BaseUsersController],
      providers: [BaseUsersService],
    }).compile();

    controller = module.get<BaseUsersController>(BaseUsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
