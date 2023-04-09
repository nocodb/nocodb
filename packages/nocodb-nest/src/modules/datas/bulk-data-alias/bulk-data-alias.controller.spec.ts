import { Test, TestingModule } from '@nestjs/testing';
import { BulkDataAliasController } from './bulk-data-alias.controller';

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
