import { Test, TestingModule } from '@nestjs/testing';
import { DataAliasExportController } from './data-alias-export.controller';

describe('DataAliasExportController', () => {
  let controller: DataAliasExportController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataAliasExportController],
    }).compile();

    controller = module.get<DataAliasExportController>(DataAliasExportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
