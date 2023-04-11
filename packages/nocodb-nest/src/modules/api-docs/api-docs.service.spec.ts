import { Test } from '@nestjs/testing';
import { ApiDocsService } from './api-docs.service';
import type { TestingModule } from '@nestjs/testing';

describe('ApiDocsService', () => {
  let service: ApiDocsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiDocsService],
    }).compile();

    service = module.get<ApiDocsService>(ApiDocsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
