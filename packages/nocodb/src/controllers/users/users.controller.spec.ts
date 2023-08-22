import { Test } from '@nestjs/testing';
import { UsersService } from '../../services/users/users.service';
import { UsersController } from './users.controller';
import type { TestingModule } from '@nestjs/testing';

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
