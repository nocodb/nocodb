import { Test } from '@nestjs/testing';
import { ViewColumnsController } from './view-columns.controller';
import { ViewColumnsService } from './view-columns.service';
import type { TestingModule } from '@nestjs/testing';

describe('ViewColumnsController', () => {
  let controller: ViewColumnsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ViewColumnsController],
      providers: [ViewColumnsService],
    }).compile();

    controller = module.get<ViewColumnsController>(ViewColumnsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
