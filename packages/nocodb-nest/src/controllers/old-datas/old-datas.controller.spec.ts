import { Test } from '@nestjs/testing';
import { OldDatasController } from './old-datas.controller';
import type { TestingModule } from '@nestjs/testing';

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
