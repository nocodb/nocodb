import { Test } from '@nestjs/testing';
import { DatasController } from './datas.controller';
import { DatasService } from '../services/datas.service';
import type { TestingModule } from '@nestjs/testing';

describe('DatasController', () => {
  let controller: DatasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatasController],
      providers: [DatasService],
    }).compile();

    controller = module.get<DatasController>(DatasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
