import { Test } from '@nestjs/testing';
import { DataAliasNestedService } from '../services/data-alias-nested.service';
import type { TestingModule } from '@nestjs/testing';

describe('DataAliasNestedService', () => {
  let service: DataAliasNestedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataAliasNestedService],
    }).compile();

    service = module.get<DataAliasNestedService>(DataAliasNestedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
