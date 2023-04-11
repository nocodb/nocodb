import { Test, TestingModule } from '@nestjs/testing';
import { DataAliasController } from './data-alias.controller';
import { DatasService } from './datas.service';

describe('DataAliasController', () => {
  let controller: DataAliasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataAliasController],
      providers: [DatasService],
    }).compile();

    controller = module.get<DataAliasController>(DataAliasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
