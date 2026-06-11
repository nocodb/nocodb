import { Test } from '@nestjs/testing';
import { GridColumnsService } from './grid-columns.service';
import type { TestingModule } from '@nestjs/testing';

describe('GridColumnsService', () => {
  let service: GridColumnsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GridColumnsService],
    }).compile();

    service = module.get<GridColumnsService>(GridColumnsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
