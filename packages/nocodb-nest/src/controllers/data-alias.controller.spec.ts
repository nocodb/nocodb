import { Test } from '@nestjs/testing';
import { DatasService } from '../services/datas.service';
import { DataAliasController } from './data-alias.controller';
import type { TestingModule } from '@nestjs/testing';

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
