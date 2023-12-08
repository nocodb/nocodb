import { Test } from '@nestjs/testing';
import { SourcesService } from './sources.service';
import type { TestingModule } from '@nestjs/testing';

describe('BasesService', () => {
  let service: SourcesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SourcesService],
    }).compile();

    service = module.get<SourcesService>(SourcesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
