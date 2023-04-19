import { Test } from '@nestjs/testing';
import { ApiTokensService } from './api-tokens.service';
import type { TestingModule } from '@nestjs/testing';

describe('ApiTokensService', () => {
  let service: ApiTokensService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiTokensService],
    }).compile();

    service = module.get<ApiTokensService>(ApiTokensService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
