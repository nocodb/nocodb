import { Test, TestingModule } from '@nestjs/testing';
import { PublicDatasController } from './public-datas.controller';
import { PublicDatasService } from './public-datas.service';

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
