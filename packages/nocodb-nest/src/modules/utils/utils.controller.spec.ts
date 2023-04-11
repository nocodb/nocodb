import { Test } from '@nestjs/testing';
import { UtilsController } from './utils.controller';
import { UtilsService } from './utils.service';
import type { TestingModule } from '@nestjs/testing';

describe('UtilsController', () => {
  let controller: UtilsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UtilsController],
      providers: [UtilsService],
    }).compile();

    controller = module.get<UtilsController>(UtilsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
