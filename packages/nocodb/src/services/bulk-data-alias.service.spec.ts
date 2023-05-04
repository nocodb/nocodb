import { Test } from '@nestjs/testing';
import { BulkDataAliasService } from './bulk-data-alias.service';
import type { TestingModule } from '@nestjs/testing';

describe('BulkDataAliasService', () => {
  let service: BulkDataAliasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BulkDataAliasService],
    }).compile();

    service = module.get<BulkDataAliasService>(BulkDataAliasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
