import { Test } from '@nestjs/testing';
import { FiltersService } from './filters.service';
import type { TestingModule } from '@nestjs/testing';

describe('FiltersService', () => {
  let service: FiltersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FiltersService],
    }).compile();

    service = module.get<FiltersService>(FiltersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
