import { Test, TestingModule } from '@nestjs/testing';
import { DatasController } from './datas.controller';
import { DatasService } from './datas.service';

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
