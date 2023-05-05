import { Test } from '@nestjs/testing';
import { PublicDatasService } from '../services/public-datas.service';
import { PublicDatasController } from './public-datas.controller';
import type { TestingModule } from '@nestjs/testing';

describe('PublicDatasController', () => {
  let controller: PublicDatasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicDatasController],
      providers: [PublicDatasService],
    }).compile();

    controller = module.get<PublicDatasController>(PublicDatasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
