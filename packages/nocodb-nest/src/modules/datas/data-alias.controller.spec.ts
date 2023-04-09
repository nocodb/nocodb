import { Test, TestingModule } from '@nestjs/testing';
import { DataAliasController } from './data-alias.controller';
import { DataAliasService } from '../data-alias/data-alias.service';

describe('DataAliasController', () => {
  let controller: DataAliasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataAliasController],
      providers: [DataAliasService],
    }).compile();

    controller = module.get<DataAliasController>(DataAliasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
