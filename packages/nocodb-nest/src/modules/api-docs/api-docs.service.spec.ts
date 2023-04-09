import { Test, TestingModule } from '@nestjs/testing';
import { ApiDocsService } from './api-docs.service';

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
