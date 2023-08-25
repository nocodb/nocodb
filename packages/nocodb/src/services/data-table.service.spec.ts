import { Test } from '@nestjs/testing';
import { DataTableService } from './data-table.service';
import type { TestingModule } from '@nestjs/testing';

describe('DataTableService', () => {
  let service: DataTableService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataTableService],
    }).compile();

    service = module.get<DataTableService>(DataTableService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
