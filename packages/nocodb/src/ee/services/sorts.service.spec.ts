import { Test } from '@nestjs/testing';
import { SortsService } from './sorts.service';
import type { TestingModule } from '@nestjs/testing';

describe('SortsService', () => {
  let service: SortsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SortsService],
    }).compile();

    service = module.get<SortsService>(SortsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
