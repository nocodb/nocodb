import { Test, TestingModule } from '@nestjs/testing';
import { OldDatasController } from './old-datas.controller';

describe('OldDatasController', () => {
  let controller: OldDatasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OldDatasController],
    }).compile();

    controller = module.get<OldDatasController>(OldDatasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
