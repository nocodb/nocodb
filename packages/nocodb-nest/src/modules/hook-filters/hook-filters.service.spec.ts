import { Test, TestingModule } from '@nestjs/testing';
import { HookFiltersService } from './hook-filters.service';

describe('HookFiltersService', () => {
  let service: HookFiltersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HookFiltersService],
    }).compile();

    service = module.get<HookFiltersService>(HookFiltersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
