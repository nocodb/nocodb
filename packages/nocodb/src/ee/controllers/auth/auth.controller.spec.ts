import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import type { TestingModule } from '@nestjs/testing';
import { UsersService } from '~/services/users/users.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [UsersService],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
