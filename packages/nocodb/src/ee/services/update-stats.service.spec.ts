import { Test } from '@nestjs/testing';
import { UpdateStatsService } from './update-stats.service';
import type { TestingModule } from '@nestjs/testing';

describe('UpdateStatsService', () => {
  let service: UpdateStatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UpdateStatsService],
    }).compile();

    service = module.get<UpdateStatsService>(UpdateStatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
