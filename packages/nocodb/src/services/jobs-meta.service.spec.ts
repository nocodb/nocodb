import { Test } from '@nestjs/testing';
import { JobsMetaService } from './jobs-meta.service';
import type { TestingModule } from '@nestjs/testing';

describe('JobsMetaService', () => {
  let service: JobsMetaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobsMetaService],
    }).compile();

    service = module.get<JobsMetaService>(JobsMetaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
