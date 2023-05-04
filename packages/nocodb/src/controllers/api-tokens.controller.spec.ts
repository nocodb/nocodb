import { Test } from '@nestjs/testing';
import { ApiTokensService } from '../services/api-tokens.service';
import { ApiTokensController } from './api-tokens.controller';
import type { TestingModule } from '@nestjs/testing';

describe('ApiTokensController', () => {
  let controller: ApiTokensController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiTokensController],
      providers: [ApiTokensService],
    }).compile();

    controller = module.get<ApiTokensController>(ApiTokensController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
