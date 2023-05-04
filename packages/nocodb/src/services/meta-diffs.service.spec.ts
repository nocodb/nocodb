import { Test } from '@nestjs/testing';
import { MetaDiffsService } from './meta-diffs.service';
import type { TestingModule } from '@nestjs/testing';

describe('MetaDiffsService', () => {
  let service: MetaDiffsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetaDiffsService],
    }).compile();

    service = module.get<MetaDiffsService>(MetaDiffsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
