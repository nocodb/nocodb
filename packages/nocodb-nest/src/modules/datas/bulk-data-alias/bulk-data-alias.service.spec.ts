import { Test, TestingModule } from '@nestjs/testing';
import { BulkDataAliasService } from './bulk-data-alias.service';

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
