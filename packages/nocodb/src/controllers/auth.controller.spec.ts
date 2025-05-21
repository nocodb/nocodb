import { Test } from '@nestjs/testing';
import { AuthService } from '../services/auth.service';
import { AuthController } from './auth/auth.controller';
import type { TestingModule } from '@nestjs/testing';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [AuthService],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
