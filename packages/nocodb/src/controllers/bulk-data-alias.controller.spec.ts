import { Test } from '@nestjs/testing';
import { BulkDataAliasController } from './bulk-data-alias.controller';
import type { TestingModule } from '@nestjs/testing';

describe('BulkDataAliasController', () => {
  let controller: BulkDataAliasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BulkDataAliasController],
    }).compile();

    controller = module.get<BulkDataAliasController>(BulkDataAliasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
